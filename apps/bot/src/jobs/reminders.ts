import { sql } from "drizzle-orm";
import type { Api } from "grammy";
import { InlineKeyboard } from "grammy";
import { salon } from "../config/salon.ts";
import { db } from "../db/client.ts";
import type { Booking } from "../db/schema.ts";
import { formatTime } from "../lib/format.ts";
import { logger } from "../logger.ts";
import { cb } from "../bot/callbacks.ts";
import { i18n, resolveLocale } from "../bot/i18n.ts";
import { getMaster, getService, masterName, serviceTitle } from "../services/catalog.ts";
import { notifyUser } from "../services/notifications.ts";
import { markBlocked, getUserById } from "../services/users.ts";

const log = logger.child({ module: "reminders" });

async function claim(kind: "24h" | "2h"): Promise<Booking[]> {
  if (kind === "24h") {
    return db.execute(sql`
      UPDATE bookings SET reminder_24h_sent_at = now()
      WHERE id IN (
        SELECT id FROM bookings
        WHERE status = 'confirmed'
          AND reminder_24h_sent_at IS NULL
          AND starts_at BETWEEN now() + interval '23 hours' AND now() + interval '25 hours'
          AND slot_assigned_at <= starts_at - interval '24 hours'
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `) as unknown as Booking[];
  }
  return db.execute(sql`
    UPDATE bookings SET reminder_2h_sent_at = now()
    WHERE id IN (
      SELECT id FROM bookings
      WHERE status = 'confirmed'
        AND reminder_2h_sent_at IS NULL
        AND starts_at BETWEEN now() + interval '1 hour 50 minutes' AND now() + interval '2 hours 10 minutes'
        AND slot_assigned_at <= starts_at - interval '2 hours'
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `) as unknown as Booking[];
}

function parseRows(result: unknown): Booking[] {
  if (Array.isArray(result)) return result as Booking[];
  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows: Booking[] }).rows;
  }
  return [];
}

async function sendOne(api: Api, booking: Booking, kind: "24h" | "2h"): Promise<void> {
  const user = await getUserById(booking.userId);
  if (!user || user.isBlocked || user.telegramId < 0) return;
  const service = await getService(booking.serviceId);
  const master = await getMaster(booking.masterId);
  if (!service || !master) return;
  const locale = resolveLocale(user);
  const vars = {
    time: formatTime(booking.startsAt, locale),
    service: serviceTitle(service, locale),
    master: masterName(master, locale),
    address: salon.address,
  };
  const text = i18n.t(locale, kind === "24h" ? "reminder-24h" : "reminder-2h", vars);
  const kb = new InlineKeyboard();
  if (kind === "24h") {
    kb.text(i18n.t(locale, "reschedule"), cb({ t: "my.rs", id: booking.id }))
      .text(i18n.t(locale, "cancel-booking"), cb({ t: "my.cx", id: booking.id }))
      .row();
  }
  kb.url(i18n.t(locale, "open-maps-short"), salon.mapsUrl);
  try {
    await api.sendMessage(user.telegramId, text, { parse_mode: "HTML", reply_markup: kb });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("403") || msg.includes("Forbidden")) {
      await markBlocked(user.id, true);
      return;
    }
    if (kind === "24h") {
      await db.execute(
        sql`UPDATE bookings SET reminder_24h_sent_at = NULL WHERE id = ${booking.id}`,
      );
    } else {
      await db.execute(
        sql`UPDATE bookings SET reminder_2h_sent_at = NULL WHERE id = ${booking.id}`,
      );
    }
    throw err;
  }
}

export async function sendDueReminders(api: Api): Promise<void> {
  const r24 = parseRows(await claim("24h"));
  const r2 = parseRows(await claim("2h"));
  let n24 = 0;
  let n2 = 0;
  for (const b of r24) {
    try {
      await sendOne(api, b, "24h");
      n24 += 1;
    } catch (err) {
      log.warn({ err, id: b.id }, "24h reminder failed");
    }
  }
  for (const b of r2) {
    try {
      await sendOne(api, b, "2h");
      n2 += 1;
    } catch (err) {
      log.warn({ err, id: b.id }, "2h reminder failed");
    }
  }
  if (n24 || n2) log.info({ reminders24h: n24, reminders2h: n2 }, "reminders sent");
}

void notifyUser;
