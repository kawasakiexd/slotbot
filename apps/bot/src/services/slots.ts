import { and, eq, gte, lt, sql } from "drizzle-orm";
import { env } from "../config/env.ts";
import { db } from "../db/client.ts";
import { bookings, masters } from "../db/schema.ts";
import { DomainError } from "../lib/errors.ts";
import {
  dayBoundsUtc,
  daysInLocalMonth,
  horizonEndUtc,
  isoWeekday,
  leadThresholdUtc,
  localDay,
  localToUtc,
  nowUtc,
  salonZone,
  startOfLocalMonth,
} from "../lib/time.ts";
import { getService, masterOffersService, mastersForService } from "./catalog.ts";
import { busyIntervals, hoursMap } from "./schedule.ts";

export interface BusyInterval {
  start: number;
  end: number;
}

export function generateStarts(input: {
  date: string;
  durationMin: number;
  work: { startMin: number; endMin: number } | null;
  busy: { start: Date; end: Date }[];
  now: Date;
  leadMin: number;
  stepMin: number;
  zone: string;
}): Date[] {
  void input.zone;
  if (!input.work) return [];
  const notBefore = new Date(input.now.getTime() + input.leadMin * 60_000);
  const out: Date[] = [];
  for (
    let minutes = input.work.startMin;
    minutes + input.durationMin <= input.work.endMin;
    minutes += input.stepMin
  ) {
    if ((minutes - input.work.startMin) % input.stepMin !== 0) continue;
    const start = localToUtc(input.date, minutes);
    if (!start) continue;
    const end = new Date(start.getTime() + input.durationMin * 60_000);
    if (start < notBefore) continue;
    const overlaps = input.busy.some((b) => start < b.end && end > b.start);
    if (overlaps) continue;
    out.push(start);
  }
  return out;
}

export function generateDaySlots(input: {
  date: string;
  window: { startMin: number; endMin: number } | null;
  durationMin: number;
  stepMin: number;
  busy: BusyInterval[];
  notBefore: Date;
}): Date[] {
  return generateStarts({
    date: input.date,
    durationMin: input.durationMin,
    work: input.window,
    busy: input.busy.map((b) => ({ start: new Date(b.start), end: new Date(b.end) })),
    now: new Date(input.notBefore.getTime() - env.MIN_LEAD_MINUTES * 60_000),
    leadMin: env.MIN_LEAD_MINUTES,
    stepMin: input.stepMin,
    zone: salonZone(),
  });
}

async function candidates(serviceId: number, masterId: number | null): Promise<number[]> {
  if (masterId && masterId > 0) {
    const ok = await masterOffersService(masterId, serviceId);
    if (!ok) return [];
    return [masterId];
  }
  const list = await mastersForService(serviceId, true);
  return list.map((m) => m.id);
}

export async function getDaySlots(q: {
  serviceId: number;
  masterId: number | null;
  date: string;
  excludeBookingId?: number;
}): Promise<Array<{ startsAt: Date; masterIds: number[] }>> {
  const service = await getService(q.serviceId);
  if (!service?.isActive) return [];
  const ids = await candidates(q.serviceId, q.masterId);
  if (ids.length === 0) return [];
  const { start, end } = dayBoundsUtc(q.date);
  const weekday = isoWeekday(q.date);
  const byStart = new Map<number, number[]>();

  for (const masterId of ids) {
    const hours = await hoursMap(masterId);
    const work = hours.get(weekday) ?? null;
    const busy = await busyIntervals(masterId, start, end, q.excludeBookingId);
    const starts = generateStarts({
      date: q.date,
      durationMin: service.durationMin,
      work,
      busy,
      now: nowUtc(),
      leadMin: env.MIN_LEAD_MINUTES,
      stepMin: env.SLOT_STEP_MINUTES,
      zone: salonZone(),
    });
    for (const s of starts) {
      const key = s.getTime();
      const list = byStart.get(key) ?? [];
      list.push(masterId);
      byStart.set(key, list);
    }
  }

  return [...byStart.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([ms, masterIds]) => ({ startsAt: new Date(ms), masterIds }));
}

export async function getMonthAvailability(q: {
  serviceId: number;
  masterId: number | null;
  month: string;
  excludeBookingId?: number;
}): Promise<Set<string>> {
  const days = daysInLocalMonth(q.month);
  const startDate = startOfLocalMonth(q.month);
  const free = new Set<string>();
  const today = localDay(nowUtc());
  const horizon = localDay(new Date(horizonEndUtc().getTime() - 1));
  for (let d = 1; d <= days; d++) {
    const date = `${q.month}-${String(d).padStart(2, "0")}`;
    if (date < today || date > horizon) continue;
    const slots = await getDaySlots({ ...q, date });
    if (slots.length > 0) free.add(date);
  }
  void startDate;
  return free;
}

export async function pickMaster(q: {
  serviceId: number;
  startsAt: Date;
  candidateIds: number[];
}): Promise<number> {
  if (q.candidateIds.length === 0) throw new DomainError("SLOT_INVALID");
  if (q.candidateIds.length === 1) return q.candidateIds[0]!;
  const date = localDay(q.startsAt);
  const { start, end } = dayBoundsUtc(date);
  const counts = await Promise.all(
    q.candidateIds.map(async (id) => {
      const rows = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(bookings)
        .where(
          and(
            eq(bookings.masterId, id),
            gte(bookings.startsAt, start),
            lt(bookings.startsAt, end),
            sql`${bookings.status} in ('pending_payment','confirmed','completed','no_show')`,
          ),
        );
      const master = await db.query.masters.findFirst({ where: eq(masters.id, id) });
      return { id, n: Number(rows[0]?.n ?? 0), sort: master?.sortOrder ?? 0 };
    }),
  );
  counts.sort((a, b) => a.n - b.n || a.sort - b.sort || a.id - b.id);
  return counts[0]!.id;
}

export async function assertSlotFree(input: {
  serviceId: number;
  masterId: number;
  startsAt: Date;
  excludeBookingId?: number;
}): Promise<void> {
  const service = await getService(input.serviceId);
  if (!service?.isActive) throw new DomainError("INACTIVE");
  if (input.startsAt < leadThresholdUtc()) {
    throw new DomainError("SLOT_TOO_SOON", { minutes: env.MIN_LEAD_MINUTES });
  }
  if (input.startsAt >= horizonEndUtc()) throw new DomainError("SLOT_INVALID");
  const date = localDay(input.startsAt);
  const slots = await getDaySlots({
    serviceId: input.serviceId,
    masterId: input.masterId,
    date,
    excludeBookingId: input.excludeBookingId,
  });
  const ok = slots.some((s) => s.startsAt.getTime() === input.startsAt.getTime());
  if (!ok) throw new DomainError("SLOT_TAKEN");
}
