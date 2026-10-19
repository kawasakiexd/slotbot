import { DateTime } from "luxon";
import { env } from "../config/env.ts";

export function salonZone(): string {
  return env.SALON_TIMEZONE;
}

export function nowUtc(): Date {
  return new Date();
}

export function localDay(d: Date): string {
  return DateTime.fromJSDate(d, { zone: "utc" }).setZone(salonZone()).toFormat("yyyy-MM-dd");
}

export function localMonth(d: Date): string {
  return DateTime.fromJSDate(d, { zone: "utc" }).setZone(salonZone()).toFormat("yyyy-MM");
}

export function dayBoundsUtc(yyyyMmDd: string): { start: Date; end: Date } {
  const start = DateTime.fromISO(yyyyMmDd, { zone: salonZone() }).startOf("day");
  return {
    start: start.toUTC().toJSDate(),
    end: start.plus({ days: 1 }).toUTC().toJSDate(),
  };
}

export function localToUtc(date: string, minutes: number): Date | null {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const dt = DateTime.fromISO(date, { zone: salonZone() }).set({
    hour,
    minute,
    second: 0,
    millisecond: 0,
  });
  if (!dt.isValid) return null;
  const localMinutes = dt.hour * 60 + dt.minute;
  if (localMinutes !== minutes) return null;
  return dt.toUTC().toJSDate();
}

export function utcToLocalMinutes(d: Date): { date: string; minutes: number } {
  const dt = DateTime.fromJSDate(d, { zone: "utc" }).setZone(salonZone());
  return { date: dt.toFormat("yyyy-MM-dd"), minutes: dt.hour * 60 + dt.minute };
}

export function epochMinutes(d: Date): number {
  return Math.floor(d.getTime() / 60_000);
}

export function fromEpochMinutes(n: number): Date {
  return new Date(n * 60_000);
}

export function isoWeekday(yyyyMmDd: string): number {
  return DateTime.fromISO(yyyyMmDd, { zone: salonZone() }).weekday;
}

export function addLocalDays(yyyyMmDd: string, days: number): string {
  return DateTime.fromISO(yyyyMmDd, { zone: salonZone() }).plus({ days }).toFormat("yyyy-MM-dd");
}

export function addLocalMonths(yyyyMm: string, months: number): string {
  return DateTime.fromISO(`${yyyyMm}-01`, { zone: salonZone() })
    .plus({ months })
    .toFormat("yyyy-MM");
}

export function startOfLocalMonth(yyyyMm: string): string {
  return `${yyyyMm}-01`;
}

export function daysInLocalMonth(yyyyMm: string): number {
  return DateTime.fromISO(`${yyyyMm}-01`, { zone: salonZone() }).daysInMonth ?? 30;
}

export function compactDate(yyyyMmDd: string): string {
  return yyyyMmDd.replaceAll("-", "");
}

export function expandDate(yyyyMMdd: string): string {
  return `${yyyyMMdd.slice(0, 4)}-${yyyyMMdd.slice(4, 6)}-${yyyyMMdd.slice(6, 8)}`;
}

export function compactMonth(yyyyMm: string): string {
  return yyyyMm.replaceAll("-", "");
}

export function expandMonth(yyyyMM: string): string {
  return `${yyyyMM.slice(0, 4)}-${yyyyMM.slice(4, 6)}`;
}

export function horizonEndUtc(): Date {
  const today = localDay(nowUtc());
  const end = DateTime.fromISO(today, { zone: salonZone() })
    .plus({ days: env.BOOKING_HORIZON_DAYS })
    .startOf("day");
  return end.toUTC().toJSDate();
}

export function leadThresholdUtc(now = nowUtc()): Date {
  return new Date(now.getTime() + env.MIN_LEAD_MINUTES * 60_000);
}
