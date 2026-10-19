import { and, gte, lt, sql } from "drizzle-orm";
import { DateTime } from "luxon";
import { db } from "../db/client.ts";
import { bookings, payments, users } from "../db/schema.ts";
import { salonZone } from "../lib/time.ts";

export type StatsPeriod = "7" | "30" | "m";

export function periodBounds(
  period: StatsPeriod,
  now = new Date(),
): { start: Date; end: Date; from: string; to: string } {
  const z = salonZone();
  const today = DateTime.fromJSDate(now, { zone: "utc" }).setZone(z).startOf("day");
  const end = today.plus({ days: 1 });
  let start = today.minus({ days: 6 });
  if (period === "30") start = today.minus({ days: 29 });
  if (period === "m") start = today.startOf("month");
  return {
    start: start.toUTC().toJSDate(),
    end: end.toUTC().toJSDate(),
    from: start.toFormat("LLL d"),
    to: today.toFormat("LLL d"),
  };
}

export interface Stats {
  from: string;
  to: string;
  start: Date;
  end: Date;
  total: number;
  completed: number;
  noshow: number;
  cancelled: number;
  upcoming: number;
  revenueMinor: number;
  depositsMinor: number;
  refundsPendingMinor: number;
  noshowRate: number;
  topServices: Array<{ nameEn: string; nameRu: string | null; count: number }>;
  topMasters: Array<{ nameEn: string; nameRu: string | null; count: number }>;
  newClients: number;
}

export async function getStats(period: StatsPeriod): Promise<Stats> {
  const bounds = periodBounds(period);
  const rows = await db.query.bookings.findMany({
    where: and(gte(bookings.startsAt, bounds.start), lt(bookings.startsAt, bounds.end)),
    with: { service: true, master: true, payment: true },
  });
  const completed = rows.filter((r) => r.status === "completed");
  const noshow = rows.filter((r) => r.status === "no_show");
  const cancelled = rows.filter((r) => r.status === "cancelled");
  const upcoming = rows.filter((r) => r.status === "confirmed" || r.status === "pending_payment");
  const closed = completed.length + noshow.length;
  const svcMap = new Map<number, { nameEn: string; nameRu: string | null; count: number }>();
  const mstMap = new Map<number, { nameEn: string; nameRu: string | null; count: number }>();
  for (const r of rows) {
    if (r.status === "cancelled") continue;
    const s = svcMap.get(r.serviceId) ?? {
      nameEn: r.service.titleEn,
      nameRu: r.service.titleRu,
      count: 0,
    };
    s.count += 1;
    svcMap.set(r.serviceId, s);
    const m = mstMap.get(r.masterId) ?? {
      nameEn: r.master.nameEn,
      nameRu: r.master.nameRu,
      count: 0,
    };
    m.count += 1;
    mstMap.set(r.masterId, m);
  }
  const payRows = await db
    .select({
      collected: sql<number>`coalesce(sum(case when ${payments.status} in ('succeeded','refund_pending','refunded') then ${payments.amountMinor} else 0 end),0)::int`,
      pending: sql<number>`coalesce(sum(case when ${payments.status} = 'refund_pending' then ${payments.amountMinor} else 0 end),0)::int`,
    })
    .from(payments)
    .innerJoin(bookings, sql`${payments.bookingId} = ${bookings.id}`)
    .where(and(gte(bookings.startsAt, bounds.start), lt(bookings.startsAt, bounds.end)));

  const [newClients] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .where(
      and(
        gte(users.createdAt, bounds.start),
        lt(users.createdAt, bounds.end),
        sql`${users.telegramId} > 0`,
      ),
    );

  return {
    ...bounds,
    total: rows.length,
    completed: completed.length,
    noshow: noshow.length,
    cancelled: cancelled.length,
    upcoming: upcoming.length,
    revenueMinor: completed.reduce((s, r) => s + r.priceMinor, 0),
    depositsMinor: Number(payRows[0]?.collected ?? 0),
    refundsPendingMinor: Number(payRows[0]?.pending ?? 0),
    noshowRate: closed === 0 ? 0 : Math.round((noshow.length / closed) * 100),
    topServices: [...svcMap.values()].sort((a, b) => b.count - a.count).slice(0, 3),
    topMasters: [...mstMap.values()].sort((a, b) => b.count - a.count).slice(0, 3),
    newClients: Number(newClients?.n ?? 0),
  };
}

export function bar(count: number, max: number): string {
  const n = max === 0 ? 0 : Math.max(1, Math.round((count / max) * 5));
  return "▇".repeat(n);
}
