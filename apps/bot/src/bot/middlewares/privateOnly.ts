import type { NextFunction } from "grammy";
import type { BotContext } from "../context.ts";

export async function privateOnly(ctx: BotContext, next: NextFunction): Promise<void> {
  if (ctx.chat && ctx.chat.type !== "private") return;
  await next();
}
