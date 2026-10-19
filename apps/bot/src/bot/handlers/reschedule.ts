import type { Composer } from "grammy";
import { InlineKeyboard } from "grammy";
import { isDomainError, errorKey } from "../../lib/errors.ts";
import { formatDateTimeWithZone } from "../../lib/format.ts";
import { fromEpochMinutes, localDay, localMonth, nowUtc } from "../../lib/time.ts";
import { getBooking, reschedule } from "../../services/bookings.ts";
import { notifyRescheduled } from "../../services/notifications.ts";
import { getDaySlots, getMonthAvailability } from "../../services/slots.ts";
import { getUser, type BotContext } from "../context.ts";
import { cb, decode } from "../callbacks.ts";
import { resolveLocale, tv } from "../i18n.ts";
import { calendarKeyboard } from "../keyboards/calendar.ts";
import { timeGridKeyboard } from "../keyboards/timeGrid.ts";
import { salon } from "../../config/salon.ts";
import { showScreen, toast } from "../views/screen.ts";
import { showMyList } from "./myBookings.ts";

export function registerReschedule(bot: Composer<BotContext>): void {
  bot.on("callback_query:data", async (ctx, next) => {
    const route = decode(ctx.callbackQuery.data);
    if (!route || (!route.t.startsWith("rs.") && route.t !== "my.rs")) return next();
    try {
      if (route.t === "my.rs") {
        return showRsCalendar(ctx, route.id, localMonth(nowUtc()));
      }
      if (route.t === "rs.c") return showRsCalendar(ctx, route.id, route.ym);
      if (route.t === "rs.d") return showRsTimes(ctx, route.id, route.d);
      if (route.t === "rs.t") return showRsConfirm(ctx, route.id, fromEpochMinutes(route.em));
      if (route.t === "rs.ok") return doRs(ctx, route.id, fromEpochMinutes(route.em));
      if (route.t === "rs.x") return showMyList(ctx, 0);
    } catch (err) {
      if (isDomainError(err)) {
        await toast(ctx, ctx.t(errorKey(err.code), tv(err.meta)));
        return;
      }
      throw err;
    }
    return next();
  });
}

async function showRsCalendar(ctx: BotContext, id: number, ym: string): Promise<void> {
  const booking = await getBooking(id);
  if (booking.userId !== getUser(ctx).id) {
    await toast(ctx, ctx.t("error-forbidden"));
    return;
  }
  const locale = resolveLocale(getUser(ctx));
  const freeDays = await getMonthAvailability({
    serviceId: booking.serviceId,
    masterId: booking.masterId,
    month: ym,
    excludeBookingId: id,
  });
  const kb = calendarKeyboard({
    locale,
    month: ym,
    freeDays,
    onDay: (d) => ({ t: "rs.d", id, d }),
    onMonth: (month) => ({ t: "rs.c", id, ym: month }),
    back: { t: "my.v", id },
    cancel: { t: "rs.x" },
  });
  await showScreen(ctx, {
    text: `${ctx.t("wizard-s3")}\n${ctx.t("wizard-tz-note", { tz: salon.tzLabel[locale] })}`,
    keyboard: kb,
  });
}

async function showRsTimes(ctx: BotContext, id: number, date: string): Promise<void> {
  const booking = await getBooking(id);
  const locale = resolveLocale(getUser(ctx));
  const slots = await getDaySlots({
    serviceId: booking.serviceId,
    masterId: booking.masterId,
    date,
    excludeBookingId: id,
  });
  const kb = timeGridKeyboard({
    locale,
    slots: slots.map((s) => s.startsAt),
    onTime: (em) => ({ t: "rs.t", id, em }),
    back: { t: "rs.c", id, ym: date.slice(0, 7) },
    cancel: { t: "rs.x" },
  });
  await showScreen(ctx, { text: ctx.t("wizard-s4"), keyboard: kb });
}

async function showRsConfirm(ctx: BotContext, id: number, startsAt: Date): Promise<void> {
  const kb = new InlineKeyboard()
    .text(ctx.t("confirm-btn"), cb({ t: "rs.ok", id, em: Math.floor(startsAt.getTime() / 60_000) }))
    .success()
    .row()
    .text(ctx.t("back"), cb({ t: "rs.d", id, d: localDay(startsAt) }))
    .text(ctx.t("cancel"), cb({ t: "rs.x" }));
  await showScreen(ctx, {
    text: ctx.t("reschedule-confirm", {
      when: formatDateTimeWithZone(startsAt, resolveLocale(getUser(ctx))),
    }),
    keyboard: kb,
  });
}

async function doRs(ctx: BotContext, id: number, startsAt: Date): Promise<void> {
  const booking = await reschedule({ userId: getUser(ctx).id, bookingId: id, startsAt });
  await notifyRescheduled(ctx.api, booking);
  await showScreen(ctx, {
    text: ctx.t("rescheduled", {
      date: formatDateTimeWithZone(booking.startsAt, resolveLocale(getUser(ctx))),
    }),
    keyboard: new InlineKeyboard().text(ctx.t("back"), cb({ t: "my.v", id: booking.id })),
  });
}
