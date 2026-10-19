import { and, asc, eq } from "drizzle-orm";
import { DEMO_SEED_ID_LIMIT } from "@slotbot/shared";
import { db } from "../db/client.ts";
import { masterServices, masters, services, type Master, type Service } from "../db/schema.ts";
import { DomainError } from "../lib/errors.ts";
import { displayName } from "../bot/i18n.ts";
import type { Viewer } from "./roles.ts";

export function serviceTitle(service: Service, locale: string): string {
  return displayName(locale, service.titleEn, service.titleRu);
}

export function masterName(master: Master, locale: string): string {
  return displayName(locale, master.nameEn, master.nameRu);
}

export async function listActiveBookableServices(): Promise<Service[]> {
  const rows = await db.query.services.findMany({
    where: eq(services.isActive, true),
    orderBy: [asc(services.sortOrder), asc(services.id)],
    with: { masterServices: { with: { master: true } } },
  });
  return rows.filter((s) => s.masterServices.some((ms) => ms.master.isActive));
}

export async function listServices(): Promise<Service[]> {
  return db.query.services.findMany({
    orderBy: [asc(services.sortOrder), asc(services.id)],
  });
}

export async function listMasters(): Promise<Master[]> {
  return db.query.masters.findMany({
    orderBy: [asc(masters.sortOrder), asc(masters.id)],
  });
}

export async function getService(id: number): Promise<Service | undefined> {
  return db.query.services.findFirst({ where: eq(services.id, id) });
}

export async function getMaster(id: number): Promise<Master | undefined> {
  return db.query.masters.findFirst({ where: eq(masters.id, id) });
}

export async function mastersForService(serviceId: number, activeOnly = true): Promise<Master[]> {
  const rows = await db.query.masterServices.findMany({
    where: eq(masterServices.serviceId, serviceId),
    with: { master: true },
  });
  return rows
    .map((r) => r.master)
    .filter((m) => (activeOnly ? m.isActive : true))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

export async function servicesForMaster(masterId: number): Promise<Service[]> {
  const rows = await db.query.masterServices.findMany({
    where: eq(masterServices.masterId, masterId),
    with: { service: true },
  });
  return rows.map((r) => r.service).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

export async function masterOffersService(masterId: number, serviceId: number): Promise<boolean> {
  const row = await db.query.masterServices.findFirst({
    where: and(eq(masterServices.masterId, masterId), eq(masterServices.serviceId, serviceId)),
  });
  return Boolean(row);
}

function assertCanDeactivate(id: number, actor: Viewer): void {
  if (actor.role === "demo" && id < DEMO_SEED_ID_LIMIT) {
    throw new DomainError("PROTECTED_ITEM");
  }
}

export async function setServiceActive(
  actor: Viewer,
  id: number,
  active: boolean,
): Promise<Service> {
  if (!active) assertCanDeactivate(id, actor);
  const [row] = await db
    .update(services)
    .set({ isActive: active })
    .where(eq(services.id, id))
    .returning();
  if (!row) throw new DomainError("NOT_FOUND");
  return row;
}

export async function setMasterActive(actor: Viewer, id: number, active: boolean): Promise<Master> {
  if (!active) assertCanDeactivate(id, actor);
  const [row] = await db
    .update(masters)
    .set({ isActive: active })
    .where(eq(masters.id, id))
    .returning();
  if (!row) throw new DomainError("NOT_FOUND");
  return row;
}

export async function updateService(
  id: number,
  patch: Partial<
    Pick<Service, "titleEn" | "titleRu" | "durationMin" | "priceMinor" | "prepayPercent">
  >,
): Promise<Service> {
  const [row] = await db.update(services).set(patch).where(eq(services.id, id)).returning();
  if (!row) throw new DomainError("NOT_FOUND");
  return row;
}

export async function updateMaster(
  id: number,
  patch: Partial<Pick<Master, "nameEn" | "nameRu">>,
): Promise<Master> {
  const [row] = await db.update(masters).set(patch).where(eq(masters.id, id)).returning();
  if (!row) throw new DomainError("NOT_FOUND");
  return row;
}

export async function toggleServiceMaster(serviceId: number, masterId: number): Promise<boolean> {
  const existing = await db.query.masterServices.findFirst({
    where: and(eq(masterServices.serviceId, serviceId), eq(masterServices.masterId, masterId)),
  });
  if (existing) {
    await db
      .delete(masterServices)
      .where(and(eq(masterServices.serviceId, serviceId), eq(masterServices.masterId, masterId)));
    return false;
  }
  await db.insert(masterServices).values({ serviceId, masterId });
  return true;
}

export async function setMasterServices(masterId: number, serviceIds: number[]): Promise<void> {
  await db.delete(masterServices).where(eq(masterServices.masterId, masterId));
  if (serviceIds.length > 0) {
    await db
      .insert(masterServices)
      .values(serviceIds.map((serviceId) => ({ masterId, serviceId })));
  }
}

export async function createService(input: {
  titleEn: string;
  titleRu: string | null;
  durationMin: number;
  priceMinor: number;
  prepayPercent: number;
  masterIds: number[];
}): Promise<Service> {
  const [row] = await db
    .insert(services)
    .values({
      titleEn: input.titleEn,
      titleRu: input.titleRu,
      durationMin: input.durationMin,
      priceMinor: input.priceMinor,
      prepayPercent: input.prepayPercent,
      sortOrder: 100,
    })
    .returning();
  if (!row) throw new Error("failed to create service");
  if (input.masterIds.length > 0) {
    await db
      .insert(masterServices)
      .values(input.masterIds.map((masterId) => ({ masterId, serviceId: row.id })));
  }
  return row;
}

export async function createMaster(input: {
  nameEn: string;
  nameRu: string | null;
  serviceIds: number[];
}): Promise<Master> {
  const [row] = await db
    .insert(masters)
    .values({ nameEn: input.nameEn, nameRu: input.nameRu, sortOrder: 100 })
    .returning();
  if (!row) throw new Error("failed to create master");
  if (input.serviceIds.length > 0) {
    await db
      .insert(masterServices)
      .values(input.serviceIds.map((serviceId) => ({ masterId: row.id, serviceId })));
  }
  return row;
}
