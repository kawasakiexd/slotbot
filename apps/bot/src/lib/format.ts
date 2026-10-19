import { formatMoney as formatMoneyShared } from "@slotbot/shared";
import { DateTime } from "luxon";
import { env } from "../config/env.ts";
import { salon } from "../config/salon.ts";
import { salonZone } from "./time.ts";

function luxonLocale(locale: string): string {
  return locale.startsWith("ru") ? "ru" : "en-US";
}

export function formatDate(d: Date, locale: string): string {
  const dt = DateTime.fromJSDate(d, { zone: "utc" })
    .setZone(salonZone())
    .setLocale(luxonLocale(locale));
  return locale.startsWith("ru") ? dt.toFormat("ccc, d LLL.") : dt.toFormat("ccc, LLL d");
}

export function formatTime(d: Date, locale: string): string {
  const dt = DateTime.fromJSDate(d, { zone: "utc" })
    .setZone(salonZone())
    .setLocale(luxonLocale(locale));
  return locale.startsWith("ru") ? dt.toFormat("HH:mm") : dt.toFormat("h:mm a");
}

export function formatDateTime(d: Date, locale: string): string {
  return `${formatDate(d, locale)} · ${formatTime(d, locale)}`;
}

export function formatDateTimeWithZone(d: Date, locale: string): string {
  const label = locale.startsWith("ru") ? salon.tzLabel.ru : salon.tzLabel.en;
  return `${formatDateTime(d, locale)} (${label})`;
}

export function formatMonthTitle(yyyyMm: string, locale: string): string {
  return DateTime.fromISO(`${yyyyMm}-01`, { zone: salonZone() })
    .setLocale(luxonLocale(locale))
    .toFormat("LLLL yyyy");
}

export function formatWeekdayShort(isoWeekday: number, locale: string): string {
  const dt = DateTime.fromObject(
    { weekday: isoWeekday as 1 | 2 | 3 | 4 | 5 | 6 | 7 },
    { zone: salonZone() },
  );
  return dt.setLocale(luxonLocale(locale)).toFormat("ccc").slice(0, 2);
}

export function formatMoney(minor: number, locale: string, currency = env.CURRENCY): string {
  return formatMoneyShared(minor, currency, locale);
}

export function formatHm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
