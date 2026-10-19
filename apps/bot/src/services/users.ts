import { and, eq, gte, inArray } from "drizzle-orm";
import type { Locale } from "@slotbot/shared";
import { db } from "../db/client.ts";
import { bookings, users, type UserRow } from "../db/schema.ts";
import { nowUtc } from "../lib/time.ts";
import { resolveLocale } from "../bot/i18n.ts";

const LAST_SEEN_MIN_MS = 5 * 60_000;

export async function upsertUser(from: {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}): Promise<UserRow> {
  const existing = await db.query.users.findFirst({
    where: eq(users.telegramId, from.id),
  });
  const now = nowUtc();
  if (!existing) {
    const [created] = await db
      .insert(users)
      .values({
        telegramId: from.id,
        firstName: from.first_name,
        lastName: from.last_name ?? null,
        username: from.username ?? null,
        languageCode: from.language_code ?? null,
        lastSeenAt: now,
      })
      .returning();
    if (!created) throw new Error("failed to insert user");
    return created;
  }

  const stale = now.getTime() - existing.lastSeenAt.getTime() > LAST_SEEN_MIN_MS;
  if (
    stale ||
    existing.firstName !== from.first_name ||
    existing.lastName !== (from.last_name ?? null) ||
    existing.username !== (from.username ?? null) ||
    existing.languageCode !== (from.language_code ?? null)
  ) {
    const [updated] = await db
      .update(users)
      .set({
        firstName: from.first_name,
        lastName: from.last_name ?? null,
        username: from.username ?? null,
        languageCode: from.language_code ?? null,
        lastSeenAt: now,
      })
      .where(eq(users.id, existing.id))
      .returning();
    return updated ?? existing;
  }
  return existing;
}

export async function setLocale(userId: number, locale: Locale): Promise<UserRow> {
  const [row] = await db.update(users).set({ locale }).where(eq(users.id, userId)).returning();
  if (!row) throw new Error("user not found");
  return row;
}

export async function setPhone(userId: number, phone: string): Promise<void> {
  await db.update(users).set({ phone }).where(eq(users.id, userId));
}

export async function markBlocked(userId: number, blocked = true): Promise<void> {
  await db.update(users).set({ isBlocked: blocked }).where(eq(users.id, userId));
}

export async function markBlockedByTelegramId(telegramId: number): Promise<void> {
  await db.update(users).set({ isBlocked: true }).where(eq(users.telegramId, telegramId));
}

export async function deleteMyData(userId: number): Promise<void> {
  const now = nowUtc();
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        firstName: "Deleted",
        lastName: null,
        username: null,
        phone: null,
        languageCode: null,
      })
      .where(eq(users.id, userId));
    await tx
      .update(bookings)
      .set({
        status: "cancelled",
        cancelReason: "client",
        cancelledAt: now,
        holdExpiresAt: null,
        clientName: "Deleted",
      })
      .where(
        and(
          eq(bookings.userId, userId),
          inArray(bookings.status, ["pending_payment", "confirmed"]),
          gte(bookings.startsAt, now),
        ),
      );
  });
}

export function userLocale(user: UserRow): Locale {
  return resolveLocale(user);
}

export async function getUserById(id: number): Promise<UserRow | undefined> {
  return db.query.users.findFirst({ where: eq(users.id, id) });
}

export async function getUserByTelegramId(telegramId: number): Promise<UserRow | undefined> {
  return db.query.users.findFirst({ where: eq(users.telegramId, telegramId) });
}
