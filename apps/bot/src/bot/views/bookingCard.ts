import { InlineKeyboard } from "grammy";
import { salon } from "../../config/salon.ts";
import { env } from "../../config/env.ts";
import type { Booking, Master, Payment, Service, UserRow } from "../../db/schema.ts";
import { formatDate, formatDateTimeWithZone, formatMoney, formatTime } from "../../lib/format.ts";
import { canChange } from "../../services/bookings.ts";
import { displayName, tv } from "../i18n.ts";
import { cb } from "../callbacks.ts";
import { i18n } from "../i18n.ts";
import { displayClient } from "../../services/privacy.ts";
import type { Viewer } from "../../services/roles.ts";
import type { Screen } from "./screen.ts";

export function statusKey(status: Booking["status"]): string {
  switch (status) {
    case "pending_payment":
      return "status-pending";
    case "confirmed":
      return "status-confirmed";
    case "completed":
      return "status-completed";
    case "no_show":
      return "status-no-show";
    default:
      return "status-cancelled";
  }
}

export function clientBookingCard(input: {
  locale: string;
  booking: Booking;
  service: Service;
  master: Master;
  payment?: Payment | null;
}): Screen {
  const { locale, booking, service, master, payment } = input;
  const t = (key: string, vars?: Record<string, unknown>) =>
    i18n.t(locale, key, vars ? tv(vars) : undefined);
  let depositLine = t("deposit-line-none");
  if (booking.prepayMinor > 0) {
    const amount = formatMoney(booking.prepayMinor, locale, booking.currency);
    depositLine =
      payment?.status === "succeeded" ||
      payment?.status === "refunded" ||
      payment?.status === "refund_pending"
        ? t("deposit-line-paid", { amount })
        : t("deposit-line-due", { amount });
  }
  const text = [
    t(statusKey(booking.status)),
    t("confirm-service", {
      service: displayName(locale, service.titleEn, service.titleRu),
      duration: service.durationMin,
    }),
    t("confirm-master", { master: displayName(locale, master.nameEn, master.nameRu) }),
    t("confirm-when", { when: formatDateTimeWithZone(booking.startsAt, locale) }),
    t("confirm-price", { price: formatMoney(booking.priceMinor, locale, booking.currency) }),
    depositLine,
  ].join("\n");

  const kb = new InlineKeyboard();
  const changeable = canChange(booking);
  if (booking.status === "pending_payment") {
    kb.text(t("pay-deposit"), cb({ t: "hold.pay", id: booking.id })).row();
    kb.text(t("release-slot"), cb({ t: "hold.rel", id: booking.id })).row();
  }
  if ((booking.status === "confirmed" || booking.status === "pending_payment") && changeable) {
    if (booking.status === "confirmed" && booking.rescheduleCount < env.MAX_RESCHEDULES) {
      kb.text(t("reschedule"), cb({ t: "my.rs", id: booking.id }));
    }
    kb.text(t("cancel-booking"), cb({ t: "my.cx", id: booking.id }))
      .danger()
      .row();
  }
  kb.url(t("open-maps-short"), salon.mapsUrl).row();
  kb.text(t("back"), cb({ t: "my.l", p: 0 }));
  return { text, keyboard: kb };
}

export function adminBookingCard(input: {
  locale: string;
  booking: Booking & { service: Service; master: Master; user?: UserRow; payment?: Payment | null };
  actor: Viewer;
}): Screen {
  const { locale, booking, actor } = input;
  const t = (key: string, vars?: Record<string, unknown>) =>
    i18n.t(locale, key, vars ? tv(vars) : undefined);
  const shown = displayClient(
    actor,
    booking.user,
    booking.clientName,
    actor.userId,
    booking.userId,
  );
  const now = new Date();
  const text = [
    `${t(statusKey(booking.status))} · ${booking.source}`,
    t("confirm-service", {
      service: displayName(locale, booking.service.titleEn, booking.service.titleRu),
      duration: booking.service.durationMin,
    }),
    t("confirm-master", {
      master: displayName(locale, booking.master.nameEn, booking.master.nameRu),
    }),
    t("confirm-when", { when: formatDateTimeWithZone(booking.startsAt, locale) }),
    t("confirm-price", { price: formatMoney(booking.priceMinor, locale, booking.currency) }),
    `💳 ${formatMoney(booking.prepayMinor, locale, booking.currency)}`,
    `👤 ${shown.name}${shown.username ? ` @${shown.username}` : ""}`,
    `Phone: ${shown.phone ?? "—"}`,
    `Payment: ${booking.payment?.status ?? "—"}`,
    `Created: ${booking.createdAt.toISOString()}`,
  ].join("\n");

  const kb = new InlineKeyboard();
  if (booking.status === "confirmed" && booking.startsAt <= now) {
    kb.text(t("admin-completed"), cb({ t: "ad.done", id: booking.id })).success();
    kb.text(t("admin-noshow"), cb({ t: "ad.ns", id: booking.id }))
      .danger()
      .row();
  }
  if (
    (booking.status === "confirmed" || booking.status === "pending_payment") &&
    booking.startsAt > now
  ) {
    kb.text(t("cancel-booking"), cb({ t: "ad.cx", id: booking.id }))
      .danger()
      .row();
  }
  if (booking.payment?.status === "refund_pending") {
    kb.text(t("admin-mark-refunded"), cb({ t: "ad.rf", id: booking.id })).row();
  }
  kb.text(t("admin-back"), cb({ t: "ad.h" }));
  return { text, keyboard: kb };
}

void formatDate;
void formatTime;
