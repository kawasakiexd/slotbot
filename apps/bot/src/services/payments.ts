import { and, eq, gt } from "drizzle-orm";
import type { PreCheckoutQuery, SuccessfulPayment } from "grammy/types";
import { env } from "../config/env.ts";
import { db } from "../db/client.ts";
import { bookings, payments, type Booking } from "../db/schema.ts";
import { isExclusionViolation } from "../db/pgErrors.ts";
import { DomainError } from "../lib/errors.ts";
import { i18n } from "../bot/i18n.ts";
import { formatDateTime, formatMoney } from "../lib/format.ts";
import { displayName, resolveLocale } from "../bot/i18n.ts";
import { getMaster, getService } from "./catalog.ts";

const USD_MIN_MINOR = 100;

export function depositMinor(priceMinor: number, percent: number, currency: string): number {
  if (!env.PAYMENTS_ENABLED || percent <= 0) return 0;
  const raw = Math.ceil((priceMinor * percent) / 100);
  const min = currency.toUpperCase() === "USD" ? USD_MIN_MINOR : 1;
  return Math.min(priceMinor, Math.max(min, raw));
}

export function invoiceParams(
  booking: Booking,
  serviceTitle: string,
  masterName: string,
  locale: string,
): {
  title: string;
  description: string;
  payload: `bk:${number}`;
  currency: string;
  prices: { label: string; amount: number }[];
  provider_token: string;
  start_parameter: `pay-${number}`;
} {
  const rest = formatMoney(booking.priceMinor - booking.prepayMinor, locale, booking.currency);
  return {
    title: i18n.t(locale, "invoice-title", { service: serviceTitle }),
    description: i18n.t(locale, "invoice-desc", {
      when: formatDateTime(booking.startsAt, locale),
      master: masterName,
      rest,
    }),
    payload: `bk:${booking.id}`,
    currency: booking.currency,
    prices: [{ label: i18n.t(locale, "invoice-label"), amount: booking.prepayMinor }],
    provider_token: env.PAYMENT_PROVIDER_TOKEN,
    start_parameter: `pay-${booking.id}`,
  };
}

export async function approvePreCheckout(
  query: PreCheckoutQuery,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const match = /^bk:(\d+)$/.exec(query.invoice_payload);
  if (!match) return { ok: false, error: i18n.t("en", "precheckout-expired") };
  const bookingId = Number(match[1]);
  const booking = await db.query.bookings.findFirst({ where: eq(bookings.id, bookingId) });
  const user = await db.query.users.findFirst({
    where: (t, ops) => ops.eq(t.telegramId, query.from.id),
  });
  const locale = user ? resolveLocale(user) : "en";
  const fail = i18n.t(locale, "precheckout-expired");
  if (!booking || !user) return { ok: false, error: fail };
  if (booking.userId !== user.id) return { ok: false, error: fail };
  if (booking.status !== "pending_payment" || !booking.holdExpiresAt) {
    return { ok: false, error: fail };
  }
  if (query.total_amount !== booking.prepayMinor || query.currency !== booking.currency) {
    return { ok: false, error: fail };
  }
  const extended = new Date(Date.now() + 5 * 60_000);
  const [row] = await db
    .update(bookings)
    .set({ holdExpiresAt: extended })
    .where(
      and(
        eq(bookings.id, bookingId),
        eq(bookings.status, "pending_payment"),
        gt(bookings.holdExpiresAt, new Date()),
      ),
    )
    .returning({ id: bookings.id });
  if (!row) return { ok: false, error: fail };
  return { ok: true };
}

export async function confirmPayment(msg: SuccessfulPayment): Promise<{
  booking: Booking;
  lateLost: boolean;
}> {
  const match = /^bk:(\d+)$/.exec(msg.invoice_payload);
  if (!match) throw new DomainError("NOT_FOUND");
  const bookingId = Number(match[1]);

  return db.transaction(async (tx) => {
    const current = await tx.query.bookings.findFirst({ where: eq(bookings.id, bookingId) });
    if (!current) throw new DomainError("NOT_FOUND");
    const inserted = await tx
      .insert(payments)
      .values({
        bookingId,
        userId: current.userId,
        amountMinor: msg.total_amount,
        currency: msg.currency,
        status: "succeeded",
        telegramChargeId: msg.telegram_payment_charge_id,
        providerChargeId: msg.provider_payment_charge_id,
      })
      .onConflictDoNothing({ target: payments.telegramChargeId })
      .returning();

    if (inserted.length === 0) {
      const existing = await tx.query.bookings.findFirst({ where: eq(bookings.id, bookingId) });
      if (!existing) throw new DomainError("NOT_FOUND");
      return { booking: existing, lateLost: false };
    }

    const [confirmed] = await tx
      .update(bookings)
      .set({
        status: "confirmed",
        holdExpiresAt: null,
        confirmedAt: new Date(),
      })
      .where(and(eq(bookings.id, bookingId), eq(bookings.status, "pending_payment")))
      .returning();
    if (confirmed) return { booking: confirmed, lateLost: false };

    try {
      const revived = await tx.transaction(async (sp) => {
        const [row] = await sp
          .update(bookings)
          .set({
            status: "confirmed",
            holdExpiresAt: null,
            cancelReason: null,
            cancelledAt: null,
            confirmedAt: new Date(),
          })
          .where(eq(bookings.id, bookingId))
          .returning();
        return row;
      });
      if (revived) return { booking: revived, lateLost: false };
    } catch (err) {
      if (!isExclusionViolation(err)) throw err;
      await tx
        .update(payments)
        .set({ status: "refund_pending" })
        .where(eq(payments.telegramChargeId, msg.telegram_payment_charge_id));
      const booking = await tx.query.bookings.findFirst({ where: eq(bookings.id, bookingId) });
      if (!booking) throw new DomainError("NOT_FOUND");
      return { booking, lateLost: true };
    }

    const booking = await tx.query.bookings.findFirst({ where: eq(bookings.id, bookingId) });
    if (!booking) throw new DomainError("NOT_FOUND");
    return { booking, lateLost: false };
  });
}

export async function markRefunded(bookingId: number): Promise<void> {
  await db
    .update(payments)
    .set({ status: "refunded", refundedAt: new Date() })
    .where(and(eq(payments.bookingId, bookingId), eq(payments.status, "refund_pending")));
}

export async function invoiceCopy(booking: Booking, locale: string) {
  const service = await getService(booking.serviceId);
  const master = await getMaster(booking.masterId);
  if (!service || !master) throw new DomainError("NOT_FOUND");
  return invoiceParams(
    booking,
    displayName(locale, service.titleEn, service.titleRu),
    displayName(locale, master.nameEn, master.nameRu),
    locale,
  );
}

export async function getPaymentForBooking(bookingId: number) {
  return db.query.payments.findFirst({ where: eq(payments.bookingId, bookingId) });
}
