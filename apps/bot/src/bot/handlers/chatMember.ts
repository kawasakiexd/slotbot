import type { Composer } from "grammy";
import { markBlockedByTelegramId } from "../../services/users.ts";
import type { BotContext } from "../context.ts";

export function registerChatMember(bot: Composer<BotContext>): void {
  bot.on("my_chat_member", async (ctx) => {
    const status = ctx.myChatMember.new_chat_member.status;
    if (status === "kicked" || status === "left") {
      await markBlockedByTelegramId(ctx.myChatMember.from.id);
    }
    if (status === "member") {
      const { upsertUser } = await import("../../services/users.ts");
      const from = ctx.myChatMember.from;
      const user = await upsertUser({
        id: from.id,
        first_name: from.first_name,
        last_name: from.last_name,
        username: from.username,
        language_code: from.language_code,
      });
      const { db } = await import("../../db/client.ts");
      const { users } = await import("../../db/schema.ts");
      const { eq } = await import("drizzle-orm");
      await db.update(users).set({ isBlocked: false }).where(eq(users.id, user.id));
    }
  });
}
