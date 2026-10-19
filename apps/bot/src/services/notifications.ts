import type { Api } from "grammy";
import { eq } from "drizzle-orm";
import { env } from "../config/env.ts";
import { salon } from "../config/salon.ts";
import { db } from "../db/client.ts";
import { users, type Booking, type UserRow } from "../db/schema.ts";
import { formatDateTime } from "../lib/format.ts";
import { logger } from "../logger.ts";
import { i18n, resolveLocale } from "../bot/i18n.ts";
import { getMaster, getService, masterName, serviceTitle } from "./catalog.ts";
import { isSeedTelegramId } from "./demo.ts";
import { markBlocked } from "./users.ts";

const log = logger.child({ module: "notify" });

export async function notifyUser(api: Api, user: UserRow, text: string): Promise<boolean> {
  if (isSeedTelegramId(user.telegramId) || user.isBlocked) return false;
  try {
    await api.sendMessage(user.telegramId, text, { parse_mode: "HTML" });
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("403") || msg.includes("blocked") || msg.includes("Forbidden")) {
      await markBlocked(user.id, true);
    }
    log.warn({ err, userId: user.id }, "notify user failed");
    return false;
  }
}

async function notifyOwners(api: Api, text: string): Promise<void> {
  if (!env.NOTIFY_ADMINS) return;
  for (const telegramId of env.adminIds) {
    const user = await db.query.users.findFirst({ where: eq(users.telegramId, telegramId) });
    if (user) await notifyUser(api, user, text);
    else {
      try {
        await api.sendMessage(telegramId, text, { parse_mode: "HTML" });
      } catch (err) {
        log.warn({ err, telegramId }, "notify owner failed");
      }
    }
  }
}

async function bookingLine(booking: Booking, locale: string) {
  const service = await getService(booking.serviceId);
  const master = await getMaster(booking.masterId);
  return {
    service: service ? serviceTitle(service, locale) : "?",
    master: master ? masterName(master, locale) : "?",
    when: formatDateTime(booking.startsAt, locale),
    client: booking.clientName,
  };
}

export async function notifyNewBooking(api: Api, booking: Booking): Promise<void> {
  for (const telegramId of env.adminIds) {
    const owner = await db.query.users.findFirst({ where: eq(users.telegramId, telegramId) });
    const locale = owner ? resolveLocale(owner) : "en";
    const line = await bookingLine(booking, locale);
    await notifyOwners(api, i18n.t(locale, "notify-new", line));
    break;
  }
}

export async function notifyCancelled(
  api: Api,
  booking: Booking,
  by: "client" | "admin",
): Promise<void> {
  const user = await db.query.users.findFirst({
    where: (t, ops) => ops.eq(t.id, booking.userId),
  });
  if (user && by === "admin") {
    const locale = resolveLocale(user);
    const line = await bookingLine(booking, locale);
    await notifyUser(
      api,
      user,
      i18n.t(locale, "cancelled-by-salon", { service: line.service, date: line.when }),
    );
  }
  for (const telegramId of env.adminIds) {
    const owner = await db.query.users.findFirst({ where: eq(users.telegramId, telegramId) });
    const locale = owner ? resolveLocale(owner) : "en";
    const line = await bookingLine(booking, locale);
    await notifyOwners(api, i18n.t(locale, "notify-cancel", line));
    break;
  }
}

export async function notifyRescheduled(api: Api, booking: Booking): Promise<void> {
  for (const telegramId of env.adminIds) {
    const owner = await db.query.users.findFirst({ where: eq(users.telegramId, telegramId) });
    const locale = owner ? resolveLocale(owner) : "en";
    const line = await bookingLine(booking, locale);
    await notifyOwners(api, i18n.t(locale, "notify-reschedule", line));
    break;
  }
}

void salon;
