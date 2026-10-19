import type { Composer } from "grammy";
import { InlineKeyboard } from "grammy";
import { formatDate, formatHm, formatTime } from "../../lib/format.ts";
import { addLocalDays, dayBoundsUtc, localDay, nowUtc } from "../../lib/time.ts";
import { daySchedule } from "../../services/bookings.ts";
import { listMasters, masterName } from "../../services/catalog.ts";
import { hoursMap, timeOffOnDate, toggleDayOff } from "../../services/schedule.ts";
import { getUser, type BotContext } from "../context.ts";
import { cb, decode } from "../callbacks.ts";
import { resolveLocale } from "../i18n.ts";
import { calendarKeyboard } from "../keyboards/calendar.ts";
import { showScreen, toast } from "../views/screen.ts";
import { env } from "../../config/env.ts";

function emoji(status: string): string {
  if (status === "confirmed") return "✅";
  if (status === "pending_payment") return "⏳";
  if (status === "completed") return "✔️";
  if (status === "no_show") return "🚫";
  return "•";
}

export function registerAdminSchedule(bot: Composer<BotContext>): void {
  bot.on("callback_query:data", async (ctx, next) => {
    const route = decode(ctx.callbackQuery.data);
    if (!route) return next();
    if (route.t === "ad.d") return showDay(ctx, route.d);
    if (route.t === "ad.c") return showPickDay(ctx, route.ym);
    if (route.t === "ad.off") {
      const on = await toggleDayOff(route.mst, route.d);
      const master = (await listMasters()).find((m) => m.id === route.mst);
      const locale = resolveLocale(getUser(ctx));
      await toast(
        ctx,
        ctx.t(on ? "day-off-on" : "day-off-off", {
          master: master ? masterName(master, locale) : "",
          date: route.d,
        }),
        false,
      );
      return showDay(ctx, route.d);
    }
    return next();
  });
}

async function showDay(ctx: BotContext, date: string): Promise<void> {
  const locale = resolveLocale(getUser(ctx));
  const bounds = dayBoundsUtc(date);
  const rows = await daySchedule(bounds.start, bounds.end);
  const masters = await listMasters();
  const lines = [`<b>${formatDate(bounds.start, locale)}</b>`];
  const kb = new InlineKeyboard();
  let buttons = 0;
  for (const master of masters.filter((m) => m.isActive)) {
    const hours = await hoursMap(master.id);
    const wd = (await import("luxon")).DateTime.fromISO(date, {
      zone: (await import("../../lib/time.ts")).salonZone(),
    }).weekday;
    const window = hours.get(wd);
    const hoursLabel = window
      ? `${formatHm(window.startMin)}–${formatHm(window.endMin)}`
      : ctx.t("hours-off");
    lines.push(`\n👤 ${masterName(master, locale)} · ${hoursLabel}`);
    const mine = rows.filter((r) => r.masterId === master.id);
    const shown = mine.slice(0, 20);
    for (const b of shown) {
      lines.push(
        `${emoji(b.status)} ${formatTime(b.startsAt, locale)}–${formatTime(b.endsAt, locale)} ${b.service.titleEn} · ${b.clientName}`,
      );
      if (buttons < 20) {
        kb.text(
          `${formatTime(b.startsAt, locale)} ${b.clientName}`,
          cb({ t: "ad.bk", id: b.id }),
        ).row();
        buttons += 1;
      }
    }
    if (mine.length > 20) lines.push(ctx.t("schedule-more", { n: mine.length - 20 }));
    const off = await timeOffOnDate(master.id, date);
    kb.text(
      `${off ? "✓ " : ""}${ctx.t("day-off-toggle", { master: masterName(master, locale) })}`,
      cb({ t: "ad.off", mst: master.id, d: date }),
    ).row();
  }
  const prev = addLocalDays(date, -1);
  const next = addLocalDays(date, 1);
  kb.text(ctx.t("prev-day"), cb({ t: "ad.d", d: prev }))
    .text(ctx.t("today-btn"), cb({ t: "ad.d", d: localDay(nowUtc()) }))
    .text(ctx.t("next-day"), cb({ t: "ad.d", d: next }))
    .row()
    .text(ctx.t("admin-back"), cb({ t: "ad.h" }));
  await showScreen(ctx, { text: lines.join("\n"), keyboard: kb });
}

async function showPickDay(ctx: BotContext, ym: string): Promise<void> {
  const locale = resolveLocale(getUser(ctx));
  const today = localDay(nowUtc());
  const min = addLocalDays(today, -30);
  const max = addLocalDays(today, env.BOOKING_HORIZON_DAYS);
  const free = new Set<string>();
  const days = (await import("../../lib/time.ts")).daysInLocalMonth(ym);
  for (let d = 1; d <= days; d++) {
    const date = `${ym}-${String(d).padStart(2, "0")}`;
    if (date >= min && date <= max) free.add(date);
  }
  const kb = calendarKeyboard({
    locale,
    month: ym,
    freeDays: free,
    onDay: (d) => ({ t: "ad.d", d }),
    onMonth: (month) => ({ t: "ad.c", ym: month }),
    back: { t: "ad.h" },
    cancel: { t: "ad.h" },
    minDate: min,
    maxDate: max,
    disableUnavailable: false,
  });
  await showScreen(ctx, { text: ctx.t("admin-pick-day"), keyboard: kb });
}
