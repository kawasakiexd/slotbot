import { eq } from "drizzle-orm";
import { env } from "../config/env.ts";
import { db } from "../db/client.ts";
import { users, type UserRow } from "../db/schema.ts";
import { nowUtc } from "../lib/time.ts";
import type { Role } from "../bot/context.ts";

export type Viewer = {
  userId: number;
  telegramId: number;
  role: Exclude<Role, null>;
};

export function getRole(user: UserRow): Role {
  if (env.adminIds.includes(user.telegramId)) return "owner";
  if (user.demoAdminUntil && user.demoAdminUntil.getTime() > nowUtc().getTime()) return "demo";
  return null;
}

export async function grantDemoAdmin(user: UserRow): Promise<{ until: Date; granted: boolean }> {
  if (!env.DEMO_MODE) {
    return { until: nowUtc(), granted: false };
  }
  if (getRole(user) === "owner") {
    return { until: nowUtc(), granted: false };
  }
  if (user.demoAdminUntil && user.demoAdminUntil.getTime() > nowUtc().getTime()) {
    return { until: user.demoAdminUntil, granted: false };
  }
  const until = new Date(nowUtc().getTime() + env.DEMO_ADMIN_MINUTES * 60_000);
  await db.update(users).set({ demoAdminUntil: until }).where(eq(users.id, user.id));
  return { until, granted: true };
}

export function demoMinutesLeft(user: UserRow): number {
  if (!user.demoAdminUntil) return 0;
  return Math.max(0, Math.ceil((user.demoAdminUntil.getTime() - nowUtc().getTime()) / 60_000));
}

export function asViewer(user: UserRow): Viewer | null {
  const role = getRole(user);
  if (!role) return null;
  return { userId: user.id, telegramId: user.telegramId, role };
}
