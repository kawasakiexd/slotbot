import { and, eq, gte, lt } from "drizzle-orm";
import { db } from "../db/client.ts";
import { bookings, timeOff, workingHours, type WorkingHour } from "../db/schema.ts";
import { dayBoundsUtc } from "../lib/time.ts";
import { DomainError } from "../lib/errors.ts";

export type HoursWindow = { startMin: number; endMin: number };

export const HOUR_PRESETS: Array<{
  id: number;
  startMin: number | null;
  endMin: number | null;
  label: string;
}> = [
  { id: 0, startMin: null, endMin: null, label: "Day off" },
  { id: 1, startMin: 9 * 60, endMin: 18 * 60, label: "09:00–18:00" },
  { id: 2, startMin: 10 * 60, endMin: 19 * 60, label: "10:00–19:00" },
  { id: 3, startMin: 10 * 60, endMin: 20 * 60, label: "10:00–20:00" },
  { id: 4, startMin: 11 * 60, endMin: 20 * 60, label: "11:00–20:00" },
];

export async function hoursForMaster(masterId: number): Promise<WorkingHour[]> {
  return db.query.workingHours.findMany({
    where: eq(workingHours.masterId, masterId),
    orderBy: (t, { asc }) => [asc(t.weekday)],
  });
}

export async function hoursMap(masterId: number): Promise<Map<number, HoursWindow>> {
  const rows = await hoursForMaster(masterId);
  return new Map(rows.map((r) => [r.weekday, { startMin: r.startMin, endMin: r.endMin }]));
}

export async function setHours(
  masterId: number,
  weekday: number,
  window: HoursWindow | null,
): Promise<number> {
  if (window === null) {
    await db
      .delete(workingHours)
      .where(and(eq(workingHours.masterId, masterId), eq(workingHours.weekday, weekday)));
  } else {
    const existing = await db.query.workingHours.findFirst({
      where: and(eq(workingHours.masterId, masterId), eq(workingHours.weekday, weekday)),
    });
    if (existing) {
      await db
        .update(workingHours)
        .set({ startMin: window.startMin, endMin: window.endMin })
        .where(eq(workingHours.id, existing.id));
    } else {
      await db.insert(workingHours).values({
        masterId,
        weekday,
        startMin: window.startMin,
        endMin: window.endMin,
      });
    }
  }
  return countBookingsOutsideHours(masterId, weekday, window);
}

async function countBookingsOutsideHours(
  masterId: number,
  weekday: number,
  window: HoursWindow | null,
): Promise<number> {
  const future = await db.query.bookings.findMany({
    where: and(
      eq(bookings.masterId, masterId),
      gte(bookings.startsAt, new Date()),
      eq(bookings.status, "confirmed"),
    ),
  });
  let n = 0;
  for (const b of future) {
    const { DateTime } = await import("luxon");
    const { salonZone } = await import("../lib/time.ts");
    const dt = DateTime.fromJSDate(b.startsAt, { zone: "utc" }).setZone(salonZone());
    if (dt.weekday !== weekday) continue;
    const startMin = dt.hour * 60 + dt.minute;
    const endMin =
      DateTime.fromJSDate(b.endsAt, { zone: "utc" }).setZone(salonZone()).hour * 60 +
      DateTime.fromJSDate(b.endsAt, { zone: "utc" }).setZone(salonZone()).minute;
    if (!window || startMin < window.startMin || endMin > window.endMin) n += 1;
  }
  return n;
}

export async function timeOffOnDate(masterId: number, date: string): Promise<boolean> {
  const { start, end } = dayBoundsUtc(date);
  const row = await db.query.timeOff.findFirst({
    where: and(
      eq(timeOff.masterId, masterId),
      eq(timeOff.startsAt, start),
      eq(timeOff.endsAt, end),
    ),
  });
  return Boolean(row);
}

export async function toggleDayOff(masterId: number, date: string): Promise<boolean> {
  const { start, end } = dayBoundsUtc(date);
  const existing = await db.query.timeOff.findFirst({
    where: and(eq(timeOff.masterId, masterId), eq(timeOff.startsAt, start)),
  });
  if (existing) {
    await db.delete(timeOff).where(eq(timeOff.id, existing.id));
    return false;
  }
  await db.insert(timeOff).values({ masterId, startsAt: start, endsAt: end, reason: "day_off" });
  return true;
}

export async function busyIntervals(
  masterId: number,
  rangeStart: Date,
  rangeEnd: Date,
  excludeBookingId?: number,
): Promise<Array<{ start: Date; end: Date }>> {
  const bookingRows = await db.query.bookings.findMany({
    where: and(
      eq(bookings.masterId, masterId),
      lt(bookings.startsAt, rangeEnd),
      gte(bookings.endsAt, rangeStart),
    ),
  });
  const offRows = await db.query.timeOff.findMany({
    where: and(
      eq(timeOff.masterId, masterId),
      lt(timeOff.startsAt, rangeEnd),
      gte(timeOff.endsAt, rangeStart),
    ),
  });
  const intervals: Array<{ start: Date; end: Date }> = [];
  for (const b of bookingRows) {
    if (excludeBookingId && b.id === excludeBookingId) continue;
    if (b.status === "cancelled") continue;
    intervals.push({ start: b.startsAt, end: b.endsAt });
  }
  for (const t of offRows) intervals.push({ start: t.startsAt, end: t.endsAt });
  return intervals;
}

export function parseCustomHours(text: string): HoursWindow | null {
  const m = text.trim().match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const startMin = Number(m[1]) * 60 + Number(m[2]);
  const endMin = Number(m[3]) * 60 + Number(m[4]);
  if (startMin % 30 !== 0 || endMin % 30 !== 0) return null;
  if (startMin < 0 || endMin > 1440 || startMin >= endMin) return null;
  return { startMin, endMin };
}

export function assertWeekday(wd: number): void {
  if (wd < 1 || wd > 7) throw new DomainError("SLOT_INVALID");
}
