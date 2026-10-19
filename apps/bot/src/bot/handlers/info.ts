import type { Composer } from "grammy";
import { env } from "../../config/env.ts";
import { salon } from "../../config/salon.ts";
import type { BotContext } from "../context.ts";
import { replyAbout } from "./start.ts";

export function registerInfo(bot: Composer<BotContext>): void {
  bot.command("about", async (ctx) => {
    await replyAbout(ctx);
  });
  bot.command("terms", async (ctx) => {
    await ctx.reply(
      ctx.t("terms-text", { hours: env.CHANGE_CUTOFF_HOURS, hold: env.HOLD_MINUTES }),
      { parse_mode: "HTML" },
    );
  });
  bot.command("support", async (ctx) => {
    await ctx.reply(
      `${ctx.t("support-text", {
        phone: salon.phone,
        address: salon.address,
        tg: salon.supportTelegram,
      })}\n\n${ctx.t("support-payments-note")}`,
      { parse_mode: "HTML" },
    );
  });
}
