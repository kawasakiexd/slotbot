import type { UserRow } from "../db/schema.ts";
import { isSeedTelegramId } from "./demo.ts";
import type { Viewer } from "./roles.ts";

export function maskName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "***";
  const first = trimmed[0] ?? "*";
  return `${first}***`;
}

export function displayClient(
  actor: Viewer | null,
  user: Pick<UserRow, "telegramId" | "firstName" | "lastName" | "username" | "phone"> | undefined,
  snapshotName: string,
  selfUserId?: number,
  bookingUserId?: number,
): { name: string; username: string | null; phone: string | null } {
  const fullName = user
    ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`.trim()
    : snapshotName;
  if (!actor || actor.role !== "demo") {
    return {
      name: fullName,
      username: user?.username ?? null,
      phone: user?.phone ?? null,
    };
  }
  if (selfUserId && bookingUserId && selfUserId === bookingUserId) {
    return { name: fullName, username: user?.username ?? null, phone: user?.phone ?? null };
  }
  if (user && isSeedTelegramId(user.telegramId)) {
    return { name: fullName, username: user.username ?? null, phone: user.phone ?? null };
  }
  return { name: maskName(fullName), username: null, phone: null };
}
