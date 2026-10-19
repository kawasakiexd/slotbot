import type { NextFunction } from "grammy";
import type { BotContext } from "../context.ts";
import { toast } from "../views/screen.ts";

export async function requireAdmin(ctx: BotContext, next: NextFunction): Promise<void> {
  const user = ctx.state.user;
  if (!user) {
    await toast(ctx, ctx.t("admin-only"));
    return;
  }
  if (ctx.state.role === "owner" || ctx.state.role === "demo") {
    await next();
    return;
  }
  if (user.demoAdminUntil) {
    await toast(ctx, ctx.t("admin-demo-expired"));
    return;
  }
  await toast(ctx, ctx.t("admin-only"));
}
