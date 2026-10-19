import { DEMO_SEED_ID_LIMIT } from "@slotbot/shared";
import { gte, lt, sql } from "drizzle-orm";
import { DateTime } from "luxon";
import { env } from "../config/env.ts";
import { db } from "../db/client.ts";
import {
  aiUsage,
  bookings,
  broadcasts,
  masterServices,
  masters,
  payments,
  services,
  timeOff,
  users,
  workingHours,
} from "../db/schema.ts";
import { hashString, mulberry32 } from "../lib/prng.ts";
import { localDay, localToUtc, salonZone } from "../lib/time.ts";
import { logger } from "../logger.ts";

const log = logger.child({ module: "demo" });

export const SEED_SERVICES = [
  {
    id: 1,
    titleEn: "Men's haircut",
    titleRu: "Мужская стрижка",
    durationMin: 45,
    priceMinor: 3500,
    prepayPercent: 0,
    sortOrder: 1,
  },
  {
    id: 2,
    titleEn: "Beard trim & shape",
    titleRu: "Оформление бороды",
    durationMin: 30,
    priceMinor: 2000,
    prepayPercent: 0,
    sortOrder: 2,
  },
  {
    id: 3,
    titleEn: "Haircut + beard",
    titleRu: "Стрижка + борода",
    durationMin: 75,
    priceMinor: 5000,
    prepayPercent: 30,
    sortOrder: 3,
  },
  {
    id: 4,
    titleEn: "Kids' haircut (under 12)",
    titleRu: "Детская стрижка (до 12 лет)",
    durationMin: 30,
    priceMinor: 2500,
    prepayPercent: 0,
    sortOrder: 4,
  },
  {
    id: 5,
    titleEn: "Hot towel shave",
    titleRu: "Бритьё с горячим полотенцем",
    durationMin: 45,
    priceMinor: 4000,
    prepayPercent: 30,
    sortOrder: 5,
  },
  {
    id: 6,
    titleEn: "Hair coloring",
    titleRu: "Окрашивание",
    durationMin: 90,
    priceMinor: 8000,
    prepayPercent: 50,
    sortOrder: 6,
  },
] as const;

export const SEED_MASTERS = [
  { id: 1, nameEn: "Alex Rivera", nameRu: "Алекс Ривера", sortOrder: 1, serviceIds: [1, 2, 3, 5] },
  { id: 2, nameEn: "Jordan Lee", nameRu: "Джордан Ли", sortOrder: 2, serviceIds: [1, 2, 3, 4] },
  { id: 3, nameEn: "Sam Patel", nameRu: "Сэм Пател", sortOrder: 3, serviceIds: [1, 4, 5, 6] },
] as const;

/** Minutes from local midnight. weekday 1=Mon … 7=Sun. */
export const SEED_HOURS: Record<number, Record<number, { startMin: number; endMin: number }>> = {
  1: {
    1: { startMin: 10 * 60, endMin: 19 * 60 },
    2: { startMin: 10 * 60, endMin: 19 * 60 },
    3: { startMin: 10 * 60, endMin: 19 * 60 },
    4: { startMin: 10 * 60, endMin: 19 * 60 },
    5: { startMin: 10 * 60, endMin: 19 * 60 },
  },
  2: {
    2: { startMin: 11 * 60, endMin: 20 * 60 },
    3: { startMin: 11 * 60, endMin: 20 * 60 },
    4: { startMin: 11 * 60, endMin: 20 * 60 },
    5: { startMin: 11 * 60, endMin: 20 * 60 },
    6: { startMin: 11 * 60, endMin: 20 * 60 },
  },
  3: {
    1: { startMin: 10 * 60, endMin: 18 * 60 },
    3: { startMin: 10 * 60, endMin: 18 * 60 },
    4: { startMin: 10 * 60, endMin: 18 * 60 },
    5: { startMin: 10 * 60, endMin: 18 * 60 },
    6: { startMin: 10 * 60, endMin: 18 * 60 },
  },
};

const SEED_CLIENTS = [
  { telegramId: -1, firstName: "Emma", lastName: "W." },
  { telegramId: -2, firstName: "Liam", lastName: "K." },
  { telegramId: -3, firstName: "Olivia", lastName: "P." },
  { telegramId: -4, firstName: "Noah", lastName: "R." },
  { telegramId: -5, firstName: "Ava", lastName: "S." },
  { telegramId: -6, firstName: "Ethan", lastName: "B." },
  { telegramId: -7, firstName: "Mia", lastName: "C." },
  { telegramId: -8, firstName: "Lucas", lastName: "D." },
  { telegramId: -9, firstName: "Sophia", lastName: "H." },
  { telegramId: -10, firstName: "Mason", lastName: "T." },
  { telegramId: -11, firstName: "Isabella", lastName: "M." },
  { telegramId: -12, firstName: "James", lastName: "L." },
] as const;

function seedDeposit(priceMinor: number, percent: number): number {
  if (percent === 0) return 0;
  const raw = Math.ceil((priceMinor * percent) / 100);
  return Math.min(priceMinor, Math.max(100, raw));
}

async function upsertCatalog(): Promise<void> {
  for (const svc of SEED_SERVICES) {
    await db
      .insert(services)
      .values({
        id: svc.id,
        titleEn: svc.titleEn,
        titleRu: svc.titleRu,
        durationMin: svc.durationMin,
        priceMinor: svc.priceMinor,
        prepayPercent: svc.prepayPercent,
        isActive: true,
        sortOrder: svc.sortOrder,
      })
      .onConflictDoUpdate({
        target: services.id,
        set: {
          titleEn: svc.titleEn,
          titleRu: svc.titleRu,
          durationMin: svc.durationMin,
          priceMinor: svc.priceMinor,
          prepayPercent: svc.prepayPercent,
          isActive: true,
          sortOrder: svc.sortOrder,
        },
      });
  }
  for (const master of SEED_MASTERS) {
    await db
      .insert(masters)
      .values({
        id: master.id,
        nameEn: master.nameEn,
        nameRu: master.nameRu,
        isActive: true,
        sortOrder: master.sortOrder,
      })
      .onConflictDoUpdate({
        target: masters.id,
        set: {
          nameEn: master.nameEn,
          nameRu: master.nameRu,
          isActive: true,
          sortOrder: master.sortOrder,
        },
      });
  }

  await db.delete(masterServices).where(lt(masterServices.masterId, DEMO_SEED_ID_LIMIT));
  await db.delete(workingHours).where(lt(workingHours.masterId, DEMO_SEED_ID_LIMIT));

  for (const master of SEED_MASTERS) {
    if (master.serviceIds.length > 0) {
      await db
        .insert(masterServices)
        .values(master.serviceIds.map((serviceId) => ({ masterId: master.id, serviceId })));
    }
    const hours = SEED_HOURS[master.id] ?? {};
    const rows = Object.entries(hours).map(([weekday, window]) => ({
      masterId: master.id,
      weekday: Number(weekday),
      startMin: window.startMin,
      endMin: window.endMin,
    }));
    if (rows.length > 0) await db.insert(workingHours).values(rows);
  }
}

async function upsertSeedClients(): Promise<Map<number, number>> {
  const idByTelegram = new Map<number, number>();
  for (const client of SEED_CLIENTS) {
    const [row] = await db
      .insert(users)
      .values({
        telegramId: client.telegramId,
        firstName: client.firstName,
        lastName: client.lastName,
        locale: "en",
        languageCode: "en",
      })
      .onConflictDoUpdate({
        target: users.telegramId,
        set: { firstName: client.firstName, lastName: client.lastName, isBlocked: false },
      })
      .returning({ id: users.id, telegramId: users.telegramId });
    if (row) idByTelegram.set(row.telegramId, row.id);
  }
  return idByTelegram;
}

function generateSeedPlacements(today: string): Array<{
  date: string;
  masterId: number;
  serviceId: number;
  startMin: number;
  status: "confirmed" | "completed" | "no_show" | "cancelled";
  clientIndex: number;
}> {
  const out: Array<{
    date: string;
    masterId: number;
    serviceId: number;
    startMin: number;
    status: "confirmed" | "completed" | "no_show" | "cancelled";
    clientIndex: number;
  }> = [];

  for (let offset = -21; offset <= 10; offset++) {
    const date = DateTime.fromISO(today, { zone: salonZone() })
      .plus({ days: offset })
      .toFormat("yyyy-MM-dd");
    const weekday = DateTime.fromISO(date, { zone: salonZone() }).weekday;
    const isPast = offset < 0;
    const occupancy = isPast ? 0.65 : offset === 0 ? 0.45 : 0.4;

    for (const master of SEED_MASTERS) {
      const window = SEED_HOURS[master.id]?.[weekday];
      if (!window) continue;
      const rng = mulberry32(hashString(`${date}:${master.id}`));
      const offered = SEED_SERVICES.filter((s) =>
        (master.serviceIds as readonly number[]).includes(s.id),
      );
      let cursor = window.startMin;
      let filled = 0;
      const capacity = window.endMin - window.startMin;

      while (cursor + 30 <= window.endMin) {
        const pick = offered[Math.floor(rng() * offered.length)];
        if (!pick) break;
        if (cursor + pick.durationMin > window.endMin) {
          cursor += 15;
          continue;
        }
        if (rng() <= occupancy) {
          let status: "confirmed" | "completed" | "no_show" | "cancelled" = "confirmed";
          if (isPast) {
            const roll = rng();
            status = roll < 0.8 ? "completed" : roll < 0.9 ? "no_show" : "cancelled";
          }
          out.push({
            date,
            masterId: master.id,
            serviceId: pick.id,
            startMin: cursor,
            status,
            clientIndex: Math.floor(rng() * SEED_CLIENTS.length),
          });
          filled += pick.durationMin;
          cursor += pick.durationMin;
        } else {
          cursor += 15;
        }
        if (filled / capacity >= occupancy + 0.05) break;
      }
    }
  }
  return out;
}

async function regenerateSeedBookings(idByTelegram: Map<number, number>): Promise<void> {
  const today = localDay(new Date());
  const placements = generateSeedPlacements(today);
  const paymentRows: Array<{
    bookingId: number;
    userId: number;
    amountMinor: number;
    currency: string;
    telegramChargeId: string;
    providerChargeId: string;
  }> = [];

  for (const [index, placement] of placements.entries()) {
    const startsAt = localToUtc(placement.date, placement.startMin);
    if (!startsAt) continue;
    const service = SEED_SERVICES.find((s) => s.id === placement.serviceId);
    if (!service) continue;
    const endsAt = new Date(startsAt.getTime() + service.durationMin * 60_000);
    const client = SEED_CLIENTS[placement.clientIndex];
    if (!client) continue;
    const userId = idByTelegram.get(client.telegramId);
    if (!userId) continue;
    const prepayMinor = seedDeposit(service.priceMinor, service.prepayPercent);
    const clientName = `${client.firstName} ${client.lastName ?? ""}`.trim();
    const confirmed = placement.status !== "cancelled";

    const [row] = await db
      .insert(bookings)
      .values({
        userId,
        masterId: placement.masterId,
        serviceId: placement.serviceId,
        startsAt,
        endsAt,
        status: placement.status,
        source: "seed",
        clientName,
        priceMinor: service.priceMinor,
        prepayMinor,
        currency: env.CURRENCY,
        holdExpiresAt: null,
        slotAssignedAt: startsAt,
        confirmedAt: confirmed ? startsAt : null,
        cancelledAt: placement.status === "cancelled" ? startsAt : null,
        cancelReason: placement.status === "cancelled" ? "client" : null,
        closedAt:
          placement.status === "completed" || placement.status === "no_show" ? endsAt : null,
      })
      .returning({ id: bookings.id });

    if (row && prepayMinor > 0 && placement.status !== "cancelled") {
      paymentRows.push({
        bookingId: row.id,
        userId,
        amountMinor: prepayMinor,
        currency: env.CURRENCY,
        telegramChargeId: `seed-tg-${row.id}-${index}`,
        providerChargeId: `seed-stripe-${row.id}-${index}`,
      });
    }
  }

  if (paymentRows.length > 0) {
    await db.insert(payments).values(paymentRows);
  }
}

export async function restoreCatalog(): Promise<void> {
  await db.update(services).set({ isActive: false }).where(gte(services.id, DEMO_SEED_ID_LIMIT));
  await db.update(masters).set({ isActive: false }).where(gte(masters.id, DEMO_SEED_ID_LIMIT));
  await db.delete(timeOff);
  await upsertCatalog();
}

export async function resetDemo(): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(payments);
    await tx.delete(bookings);
    await tx.delete(timeOff);
    await tx.delete(broadcasts);
    await tx.delete(masterServices).where(gte(masterServices.masterId, DEMO_SEED_ID_LIMIT));
    await tx.delete(workingHours).where(gte(workingHours.masterId, DEMO_SEED_ID_LIMIT));
    await tx.delete(masters).where(gte(masters.id, DEMO_SEED_ID_LIMIT));
    await tx.delete(services).where(gte(services.id, DEMO_SEED_ID_LIMIT));
    await tx
      .update(users)
      .set({ demoAdminUntil: null })
      .where(sql`${users.demoAdminUntil} is not null`);
    const cutoff = DateTime.utc().minus({ days: 30 }).toISODate();
    if (cutoff) await tx.delete(aiUsage).where(lt(aiUsage.day, cutoff));
  });

  await upsertCatalog();
  const idByTelegram = await upsertSeedClients();
  await regenerateSeedBookings(idByTelegram);
  log.info("demo data reset");
}

export async function catalogIsEmpty(): Promise<boolean> {
  const rows = await db.select({ id: services.id }).from(services).limit(1);
  return rows.length === 0;
}

export function isSeedTelegramId(telegramId: number): boolean {
  return telegramId < 0;
}

export function isSeedCatalogId(id: number): boolean {
  return id < DEMO_SEED_ID_LIMIT;
}
