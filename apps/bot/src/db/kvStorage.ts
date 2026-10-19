import type {
  ConversationData,
  VersionedState,
  VersionedStateStorage,
} from "@grammyjs/conversations";
import { eq } from "drizzle-orm";
import { db } from "./client.ts";
import { botKv } from "./schema.ts";

const CONV_PREFIX = "conv:";

export function createKvStorage(): VersionedStateStorage<string, ConversationData> {
  return {
    async read(key) {
      const row = await db.query.botKv.findFirst({
        where: eq(botKv.key, CONV_PREFIX + key),
      });
      if (!row) return undefined;
      return row.value as VersionedState<ConversationData>;
    },
    async write(key, state) {
      await db
        .insert(botKv)
        .values({ key: CONV_PREFIX + key, value: state })
        .onConflictDoUpdate({
          target: botKv.key,
          set: { value: state, updatedAt: new Date() },
        });
    },
    async delete(key) {
      await db.delete(botKv).where(eq(botKv.key, CONV_PREFIX + key));
    },
  };
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const row = await db.query.botKv.findFirst({ where: eq(botKv.key, key) });
  return row?.value as T | undefined;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  await db
    .insert(botKv)
    .values({ key, value })
    .onConflictDoUpdate({
      target: botKv.key,
      set: { value, updatedAt: new Date() },
    });
}
