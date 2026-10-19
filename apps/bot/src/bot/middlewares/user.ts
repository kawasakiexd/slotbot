import type { NextFunction } from "grammy";
import { getRole } from "../../services/roles.ts";
import { upsertUser } from "../../services/users.ts";
import type { BotContext } from "../context.ts";

export async function userMiddleware(ctx: BotContext, next: NextFunction): Promise<void> {
  ctx.state ??= { role: null };
  const from = ctx.from;
  if (!from) {
    await next();
    return;
  }
  const user = await upsertUser({
    id: from.id,
    first_name: from.first_name,
    last_name: from.last_name,
    username: from.username,
    language_code: from.language_code,
  });
  ctx.state.user = user;
  ctx.state.role = getRole(user);
  await next();
}
