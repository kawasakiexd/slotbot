import { and, count, desc, eq, gte, inArray, or, sql } from "drizzle-orm";
import { env } from "../config/env.ts";
import { db } from "../db/client.ts";
import { isExclusionViolation, isUniqueViolation } from "../db/pgErrors.ts";
import { bookings, payments, users, type Booking, type UserRow } from "../db/schema.ts";
import { DomainError } from "../lib/errors.ts";
import { nowUtc } from "../lib/time.ts";
import { getMaster, getService } from "./catalog.ts";
import { depositMinor } from "./payments.ts";
import type { Viewer } from "./roles.ts";
import { assertSlotFree } from "./slots.ts";
import { isSeedTelegramId } from "./demo.ts";

const OPEN_STATUSES = ["pending_payment", "confirmed"] as const;

function clientNameOf(user: UserRow): string {
  return `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`.trim();
}

async function countActive(userId: number, exec: Pick<typeof db, "select"> = db): Promise<number> {
  const [row] = await exec
    .select({ n: count() })
    .from(bookings)
    .where(
      and(
        eq(bookings.userId, userId),
        inArray(bookings.status, [...OPEN_STATUSES]),
        gte(bookings.startsAt, nowUtc()),
      ),
    );
  return Number(row?.n ?? 0);
}

export async function createBooking(input: {
  userId: number;
  serviceId: number;
  masterId: number;
  startsAt: Date;
  source: "bot" | "miniapp";
}): Promise<{ booking: Booking; replacedHold: boolean }> {
  const user = await db.query.users.findFirst({ where: eq(users.id, input.userId) });
  if (!user) throw new DomainError("NOT_FOUND");
  const service = await getService(input.serviceId);
  const master = await getMaster(input.masterId);
  if (!service?.isActive || !master?.isActive) throw new DomainError("INACTIVE");
  await assertSlotFree({
    serviceId: input.serviceId,
    masterId: input.masterId,
    startsAt: input.startsAt,
  });
  const endsAt = new Date(input.startsAt.getTime() + service.durationMin * 60_000);
  const prepay = depositMinor(service.priceMinor, service.prepayPercent, env.CURRENCY);
  const needsHold = prepay > 0;
  const now = nowUtc();

  const attempt = async (): Promise<{ booking: Booking; replacedHold: boolean }> =>
    db.transaction(async (tx) => {
      const active = await countActive(input.userId, tx);
      if (active >= env.MAX_ACTIVE_BOOKINGS_PER_USER) {
        throw new DomainError("LIMIT_ACTIVE", { count: env.MAX_ACTIVE_BOOKINGS_PER_USER });
      }
      const released = await tx
        .update(bookings)
        .set({
          status: "cancelled",
          cancelReason: "replaced",
          cancelledAt: now,
          holdExpiresAt: null,
        })
        .where(and(eq(bookings.userId, input.userId), eq(bookings.status, "pending_payment")))
        .returning({ id: bookings.id });

      const [row] = await tx
        .insert(bookings)
        .values({
          userId: input.userId,
          masterId: input.masterId,
          serviceId: input.serviceId,
          startsAt: input.startsAt,
          endsAt,
          status: needsHold ? "pending_payment" : "confirmed",
          source: input.source,
          clientName: clientNameOf(user),
          priceMinor: service.priceMinor,
          prepayMinor: prepay,
          currency: env.CURRENCY,
          holdExpiresAt: needsHold ? new Date(now.getTime() + env.HOLD_MINUTES * 60_000) : null,
          slotAssignedAt: now,
          confirmedAt: needsHold ? null : now,
        })
        .returning();
      if (!row) throw new Error("insert booking failed");
      return { booking: row, replacedHold: released.length > 0 };
    });

  try {
    return await attempt();
  } catch (err) {
    if (isExclusionViolation(err)) throw new DomainError("SLOT_TAKEN");
    if (isUniqueViolation(err)) {
      try {
        return await attempt();
      } catch (err2) {
        if (isExclusionViolation(err2)) throw new DomainError("SLOT_TAKEN");
        throw err2;
      }
    }
    throw err;
  }
}

export function canChange(booking: Booking, now = nowUtc()): boolean {
  const cutoff = env.CHANGE_CUTOFF_HOURS * 60 * 60_000;
  return booking.startsAt.getTime() - now.getTime() >= cutoff;
}

export async function cancelByClient(input: {
  userId: number;
  bookingId: number;
}): Promise<{ booking: Booking; refundPending: boolean }> {
  const booking = await getOwned(input.userId, input.bookingId);
  if (!OPEN_STATUSES.includes(booking.status as (typeof OPEN_STATUSES)[number])) {
    throw new DomainError("NOT_FOUND");
  }
  if (!canChange(booking)) {
    throw new DomainError("CUTOFF", { hours: env.CHANGE_CUTOFF_HOURS });
  }
  return cancelBooking(booking, "client");
}

export async function reschedule(input: {
  userId: number;
  bookingId: number;
  startsAt: Date;
}): Promise<Booking> {
  const booking = await getOwned(input.userId, input.bookingId);
  if (booking.status !== "confirmed" && booking.status !== "pending_payment") {
    throw new DomainError("NOT_FOUND");
  }
  if (!canChange(booking)) throw new DomainError("CUTOFF", { hours: env.CHANGE_CUTOFF_HOURS });
  if (booking.rescheduleCount >= env.MAX_RESCHEDULES) throw new DomainError("RESCHEDULE_LIMIT");
  const service = await getService(booking.serviceId);
  if (!service) throw new DomainError("NOT_FOUND");
  await assertSlotFree({
    serviceId: booking.serviceId,
    masterId: booking.masterId,
    startsAt: input.startsAt,
    excludeBookingId: booking.id,
  });
  const endsAt = new Date(input.startsAt.getTime() + service.durationMin * 60_000);
  const now = nowUtc();
  try {
    const [row] = await db
      .update(bookings)
      .set({
        startsAt: input.startsAt,
        endsAt,
        slotAssignedAt: now,
        rescheduleCount: booking.rescheduleCount + 1,
        reminder24hSentAt: null,
        reminder2hSentAt: null,
      })
      .where(eq(bookings.id, booking.id))
      .returning();
    if (!row) throw new DomainError("NOT_FOUND");
    return row;
  } catch (err) {
    if (isExclusionViolation(err)) throw new DomainError("SLOT_TAKEN");
    throw err;
  }
}

export async function cancelByAdmin(input: {
  actor: Viewer;
  bookingId: number;
}): Promise<{ booking: Booking; refundPending: boolean }> {
  const booking = await getBooking(input.bookingId);
  await assertSandbox(input.actor, booking);
  if (!OPEN_STATUSES.includes(booking.status as (typeof OPEN_STATUSES)[number])) {
    throw new DomainError("NOT_FOUND");
  }
  return cancelBooking(booking, "admin");
}

export async function closeBooking(input: {
  actor: Viewer;
  bookingId: number;
  status: "completed" | "no_show";
}): Promise<Booking> {
  const booking = await getBooking(input.bookingId);
  await assertSandbox(input.actor, booking);
  if (booking.status !== "confirmed") throw new DomainError("NOT_FOUND");
  if (booking.startsAt > nowUtc()) throw new DomainError("FORBIDDEN");
  const [row] = await db
    .update(bookings)
    .set({ status: input.status, closedAt: nowUtc() })
    .where(eq(bookings.id, booking.id))
    .returning();
  if (!row) throw new DomainError("NOT_FOUND");
  return row;
}

async function cancelBooking(
  booking: Booking,
  reason: "client" | "admin",
): Promise<{ booking: Booking; refundPending: boolean }> {
  const now = nowUtc();
  const [row] = await db
    .update(bookings)
    .set({
      status: "cancelled",
      cancelReason: reason,
      cancelledAt: now,
      holdExpiresAt: null,
    })
    .where(eq(bookings.id, booking.id))
    .returning();
  if (!row) throw new DomainError("NOT_FOUND");
  let refundPending = false;
  if (booking.prepayMinor > 0 && booking.status === "confirmed") {
    const pay = await db.query.payments.findFirst({ where: eq(payments.bookingId, booking.id) });
    if (pay?.status === "succeeded") {
      await db.update(payments).set({ status: "refund_pending" }).where(eq(payments.id, pay.id));
      refundPending = true;
    }
  }
  return { booking: row, refundPending };
}

export async function releaseHold(userId: number, bookingId: number): Promise<Booking> {
  const booking = await getOwned(userId, bookingId);
  if (booking.status !== "pending_payment") throw new DomainError("HOLD_EXPIRED");
  const [row] = await db
    .update(bookings)
    .set({
      status: "cancelled",
      cancelReason: "client",
      cancelledAt: nowUtc(),
      holdExpiresAt: null,
    })
    .where(eq(bookings.id, booking.id))
    .returning();
  if (!row) throw new DomainError("NOT_FOUND");
  return row;
}

export async function listMine(userId: number, page: number, pageSize = 6) {
  const now = nowUtc();
  const rows = await db.query.bookings.findMany({
    where: and(
      eq(bookings.userId, userId),
      inArray(bookings.status, [...OPEN_STATUSES]),
      gte(bookings.startsAt, now),
    ),
    orderBy: (t, { asc }) => [asc(t.startsAt)],
    with: { service: true, master: true, payment: true },
  });
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const p = Math.min(Math.max(0, page), totalPages - 1);
  return {
    rows: rows.slice(p * pageSize, p * pageSize + pageSize),
    page: p,
    totalPages,
    total: rows.length,
  };
}

export async function listUpcoming(page: number, pageSize = 8) {
  const now = nowUtc();
  const rows = await db.query.bookings.findMany({
    where: and(inArray(bookings.status, [...OPEN_STATUSES]), gte(bookings.startsAt, now)),
    orderBy: (t, { asc }) => [asc(t.startsAt)],
    with: { service: true, master: true, user: true, payment: true },
  });
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const p = Math.min(Math.max(0, page), totalPages - 1);
  return {
    rows: rows.slice(p * pageSize, p * pageSize + pageSize),
    page: p,
    totalPages,
    total: rows.length,
  };
}

export async function daySchedule(dateStart: Date, dateEnd: Date) {
  return db.query.bookings.findMany({
    where: and(
      gte(bookings.startsAt, dateStart),
      sql`${bookings.startsAt} < ${dateEnd}`,
      sql`${bookings.status} in ('pending_payment','confirmed','completed','no_show')`,
    ),
    orderBy: (t, { asc }) => [asc(t.startsAt)],
    with: { service: true, master: true, user: true, payment: true },
  });
}

export async function getBooking(id: number) {
  const row = await db.query.bookings.findFirst({
    where: eq(bookings.id, id),
    with: { service: true, master: true, user: true, payment: true },
  });
  if (!row) throw new DomainError("NOT_FOUND");
  return row;
}

async function getOwned(userId: number, bookingId: number): Promise<Booking> {
  const row = await db.query.bookings.findFirst({
    where: and(eq(bookings.id, bookingId), eq(bookings.userId, userId)),
  });
  if (!row) throw new DomainError("NOT_FOUND");
  return row;
}

async function assertSandbox(actor: Viewer, booking: Booking): Promise<void> {
  if (actor.role !== "demo") return;
  if (booking.userId === actor.userId) return;
  const owner = await db.query.users.findFirst({ where: eq(users.id, booking.userId) });
  if (owner && isSeedTelegramId(owner.telegramId)) return;
  throw new DomainError("SANDBOX_DENIED");
}

export async function setInvoiceMessageId(bookingId: number, messageId: number): Promise<void> {
  await db.update(bookings).set({ invoiceMessageId: messageId }).where(eq(bookings.id, bookingId));
}

export async function todayCounts() {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const { dayBoundsUtc, localDay } = await import("../lib/time.ts");
  const bounds = dayBoundsUtc(localDay(nowUtc()));
  const [all] = await db
    .select({ n: count() })
    .from(bookings)
    .where(
      and(
        gte(bookings.startsAt, bounds.start),
        sql`${bookings.startsAt} < ${bounds.end}`,
        sql`${bookings.status} in ('pending_payment','confirmed','completed','no_show')`,
      ),
    );
  const [pending] = await db
    .select({ n: count() })
    .from(bookings)
    .where(
      and(
        gte(bookings.startsAt, bounds.start),
        sql`${bookings.startsAt} < ${bounds.end}`,
        eq(bookings.status, "pending_payment"),
      ),
    );
  return { todayCount: Number(all?.n ?? 0), pending: Number(pending?.n ?? 0) };
}

void or;
void desc;
