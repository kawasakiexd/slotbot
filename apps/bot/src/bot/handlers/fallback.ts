import type { Composer } from "grammy";
import type { BotContext } from "../context.ts";
import { getUser } from "../context.ts";
import { resolveLocale } from "../i18n.ts";
import { menuExtra } from "../keyboards/mainMenu.ts";

export function registerFallback(bot: Composer<BotContext>): void {
  bot.on("message:text", async (ctx) => {
    if (!ctx.message.text.startsWith("/")) return;
    await ctx.reply(
      ctx.t("unknown-command"),
      menuExtra(resolveLocale(getUser(ctx)), ctx.state.role),
    );
  });
  bot.on("callback_query:data", async (ctx) => {
    await ctx.answerCallbackQuery({ text: ctx.t("outdated") });
  });
}
