import { eq, sql } from "drizzle-orm";
import type { Api } from "grammy";
import { db } from "../db/client.ts";
import { broadcasts, users } from "../db/schema.ts";
import { logger } from "../logger.ts";
import { markBlocked } from "./users.ts";
import type { Viewer } from "./roles.ts";

const log = logger.child({ module: "broadcast" });

export async function listRecipientIds(actor: Viewer): Promise<number[]> {
  if (actor.role === "demo") return [actor.telegramId];
  const rows = await db
    .select({ telegramId: users.telegramId, id: users.id })
    .from(users)
    .where(sql`${users.telegramId} > 0 and ${users.isBlocked} = false`);
  return rows.map((r) => r.telegramId);
}

export async function sendBroadcast(
  api: Api,
  actor: Viewer,
  text: string,
): Promise<{ sent: number; failed: number; total: number }> {
  const recipients = await listRecipientIds(actor);
  const [row] = await db
    .insert(broadcasts)
    .values({
      createdBy: actor.userId,
      text,
      isSandbox: actor.role === "demo",
      recipientsTotal: recipients.length,
    })
    .returning();
  if (!row) throw new Error("broadcast insert failed");

  let sent = 0;
  let failed = 0;
  for (const chatId of recipients) {
    try {
      await api.sendMessage(chatId, text);
      sent += 1;
    } catch (err) {
      failed += 1;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("403") || msg.includes("Forbidden")) {
        const user = await db.query.users.findFirst({
          where: (t, ops) => ops.eq(t.telegramId, chatId),
        });
        if (user) await markBlocked(user.id, true);
      }
      log.warn({ err, chatId }, "broadcast send failed");
    }
  }
  await db
    .update(broadcasts)
    .set({
      sentCount: sent,
      failedCount: failed,
      status: "done",
      finishedAt: new Date(),
    })
    .where(eq(broadcasts.id, row.id));
  return { sent, failed, total: recipients.length };
}
