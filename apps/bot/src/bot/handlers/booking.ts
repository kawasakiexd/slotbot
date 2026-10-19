import type { Composer } from "grammy";
import { InlineKeyboard } from "grammy";
import { env } from "../../config/env.ts";
import { salon } from "../../config/salon.ts";
import { DomainError, errorKey, isDomainError } from "../../lib/errors.ts";
import { formatDate, formatDateTimeWithZone, formatMoney, formatTime } from "../../lib/format.ts";
import { fromEpochMinutes, localMonth, nowUtc } from "../../lib/time.ts";
import { createBooking } from "../../services/bookings.ts";
import {
  getMaster,
  getService,
  listActiveBookableServices,
  masterName,
  mastersForService,
  serviceTitle,
} from "../../services/catalog.ts";
import { depositMinor } from "../../services/payments.ts";
import { notifyNewBooking } from "../../services/notifications.ts";
import { getDaySlots, getMonthAvailability, pickMaster } from "../../services/slots.ts";
import { getUser, type BotContext } from "../context.ts";
import { cb, decode } from "../callbacks.ts";
import { resolveLocale, tv } from "../i18n.ts";
import { calendarKeyboard } from "../keyboards/calendar.ts";
import { timeGridKeyboard } from "../keyboards/timeGrid.ts";
import { clientBookingCard } from "../views/bookingCard.ts";
import { showScreen, toast } from "../views/screen.ts";
import { sendInvoiceFor } from "./payments.ts";

export function registerBooking(bot: Composer<BotContext>): void {
  bot.on("callback_query:data", async (ctx, next) => {
    const route = decode(ctx.callbackQuery.data);
    if (!route || !route.t.startsWith("bk.")) return next();
    try {
      if (route.t === "bk.s" || route.t === "bk.x") return showServices(ctx);
      if (route.t === "bk.sp") return showMasters(ctx, route.svc);
      if (route.t === "bk.m") return showMasters(ctx, route.svc);
      if (route.t === "bk.mp") {
        return showCalendar(ctx, route.svc, route.mst, localMonth(nowUtc()));
      }
      if (route.t === "bk.c") return showCalendar(ctx, route.svc, route.mst, route.ym);
      if (route.t === "bk.d") return showTimes(ctx, route.svc, route.mst, route.d);
      if (route.t === "bk.t")
        return showConfirm(ctx, route.svc, route.mst, fromEpochMinutes(route.em));
      if (route.t === "bk.ok")
        return confirm(ctx, route.svc, route.mst, fromEpochMinutes(route.em));
    } catch (err) {
      await handleWizardError(ctx, err);
    }
  });
}

export async function showServices(ctx: BotContext): Promise<void> {
  const locale = resolveLocale(getUser(ctx));
  const list = await listActiveBookableServices();
  const kb = new InlineKeyboard();
  for (const svc of list) {
    const dep = depositMinor(svc.priceMinor, svc.prepayPercent, env.CURRENCY) > 0 ? " 💳" : "";
    kb.text(
      `${serviceTitle(svc, locale)} · ${svc.durationMin} min · ${formatMoney(svc.priceMinor, locale)}${dep}`,
      cb({ t: "bk.sp", svc: svc.id }),
    ).row();
  }
  kb.text(ctx.t("cancel"), cb({ t: "bk.x" }));
  await showScreen(ctx, { text: ctx.t("wizard-s1"), keyboard: kb });
}

export async function showMasters(ctx: BotContext, svc: number): Promise<void> {
  const locale = resolveLocale(getUser(ctx));
  const service = await getService(svc);
  if (!service?.isActive) throw new DomainError("INACTIVE");
  const masters = await mastersForService(svc, true);
  const kb = new InlineKeyboard();
  kb.text(ctx.t("any-master"), cb({ t: "bk.mp", svc, mst: 0 })).row();
  for (const m of masters) {
    kb.text(masterName(m, locale), cb({ t: "bk.mp", svc, mst: m.id })).row();
  }
  kb.text(ctx.t("back"), cb({ t: "bk.s" })).text(ctx.t("cancel"), cb({ t: "bk.x" }));
  await showScreen(ctx, {
    text: `${ctx.t("wizard-s2")}\n${serviceTitle(service, locale)}`,
    keyboard: kb,
  });
}

async function showCalendar(ctx: BotContext, svc: number, mst: number, ym: string): Promise<void> {
  const locale = resolveLocale(getUser(ctx));
  const freeDays = await getMonthAvailability({
    serviceId: svc,
    masterId: mst === 0 ? null : mst,
    month: ym,
  });
  const kb = calendarKeyboard({
    locale,
    month: ym,
    freeDays,
    onDay: (d) => ({ t: "bk.d", svc, mst, d }),
    onMonth: (month) => ({ t: "bk.c", svc, mst, ym: month }),
    back: { t: "bk.m", svc },
    cancel: { t: "bk.x" },
  });
  await showScreen(ctx, {
    text: `${ctx.t("wizard-s3")}\n${ctx.t("wizard-tz-note", { tz: salon.tzLabel[locale] })}`,
    keyboard: kb,
  });
}

async function showTimes(ctx: BotContext, svc: number, mst: number, date: string): Promise<void> {
  const locale = resolveLocale(getUser(ctx));
  const slots = await getDaySlots({
    serviceId: svc,
    masterId: mst === 0 ? null : mst,
    date,
  });
  if (slots.length === 0) {
    await toast(ctx, ctx.t("times-empty"));
    await showCalendar(ctx, svc, mst, date.slice(0, 7));
    return;
  }
  const starts = slots.map((s) => s.startsAt);
  const kb = timeGridKeyboard({
    locale,
    slots: starts,
    onTime: (em) => ({ t: "bk.t", svc, mst, em }),
    back: { t: "bk.c", svc, mst, ym: date.slice(0, 7) },
    cancel: { t: "bk.x" },
  });
  const sample = starts[0]!;
  await showScreen(ctx, {
    text: `${ctx.t("wizard-s4")}\n${formatDate(sample, locale)}`,
    keyboard: kb,
  });
}

async function resolveMaster(svc: number, mst: number, startsAt: Date): Promise<number> {
  if (mst > 0) return mst;
  const { localDay } = await import("../../lib/time.ts");
  const date = localDay(startsAt);
  const daySlots = await getDaySlots({ serviceId: svc, masterId: null, date });
  const hit = daySlots.find((s) => s.startsAt.getTime() === startsAt.getTime());
  if (!hit) throw new DomainError("SLOT_TAKEN");
  return pickMaster({ serviceId: svc, startsAt, candidateIds: hit.masterIds });
}

async function showConfirm(
  ctx: BotContext,
  svc: number,
  mst: number,
  startsAt: Date,
): Promise<void> {
  const locale = resolveLocale(getUser(ctx));
  const masterId = await resolveMaster(svc, mst, startsAt);
  const service = await getService(svc);
  const master = await getMaster(masterId);
  if (!service || !master) throw new DomainError("NOT_FOUND");
  const deposit = depositMinor(service.priceMinor, service.prepayPercent, env.CURRENCY);
  const lines = [
    ctx.t("wizard-s5-title"),
    ctx.t("confirm-service", {
      service: serviceTitle(service, locale),
      duration: service.durationMin,
    }),
    ctx.t("confirm-master", { master: masterName(master, locale) }),
    ctx.t("confirm-when", { when: formatDateTimeWithZone(startsAt, locale) }),
    ctx.t("confirm-price", { price: formatMoney(service.priceMinor, locale) }),
  ];
  if (deposit > 0) {
    lines.push(ctx.t("confirm-deposit", { deposit: formatMoney(deposit, locale) }));
  }
  lines.push(ctx.t("confirm-policy", { hours: env.CHANGE_CUTOFF_HOURS }));
  lines.push(ctx.t("confirm-terms"));
  const kb = new InlineKeyboard()
    .text(
      deposit > 0 ? ctx.t("confirm-pay-btn") : ctx.t("confirm-btn"),
      cb({
        t: "bk.ok",
        svc,
        mst: masterId,
        em: Math.floor(startsAt.getTime() / 60_000),
      }),
    )
    .success()
    .row()
    .text(
      ctx.t("back"),
      cb({ t: "bk.d", svc, mst, d: (await import("../../lib/time.ts")).localDay(startsAt) }),
    )
    .text(ctx.t("cancel"), cb({ t: "bk.x" }));
  await showScreen(ctx, { text: lines.join("\n"), keyboard: kb });
}

async function confirm(ctx: BotContext, svc: number, mst: number, startsAt: Date): Promise<void> {
  const user = getUser(ctx);
  const locale = resolveLocale(user);
  const { booking, replacedHold } = await createBooking({
    userId: user.id,
    serviceId: svc,
    masterId: mst,
    startsAt,
    source: "bot",
  });
  if (replacedHold) await ctx.reply(ctx.t("hold-replaced"));
  await notifyNewBooking(ctx.api, booking);
  if (booking.status === "pending_payment") {
    const kb = new InlineKeyboard().text(
      ctx.t("release-slot"),
      cb({ t: "hold.rel", id: booking.id }),
    );
    await showScreen(ctx, {
      text: ctx.t("hold-started", { minutes: env.HOLD_MINUTES }),
      keyboard: kb,
    });
    await sendInvoiceFor(ctx, booking);
    return;
  }
  const service = await getService(booking.serviceId);
  const master = await getMaster(booking.masterId);
  if (!service || !master) return;
  const card = clientBookingCard({ locale, booking, service, master });
  await showScreen(ctx, { text: `${ctx.t("booked")}\n\n${card.text}`, keyboard: card.keyboard });
}

async function handleWizardError(ctx: BotContext, err: unknown): Promise<void> {
  if (!isDomainError(err)) throw err;
  const key = errorKey(err.code);
  await toast(ctx, ctx.t(key, tv(err.meta)));
  if (err.code === "SLOT_TAKEN") {
    await showServices(ctx);
  }
}

void formatTime;
