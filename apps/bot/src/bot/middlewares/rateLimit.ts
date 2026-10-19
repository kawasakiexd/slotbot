import { limit } from "@grammyjs/ratelimiter";
import type { Context } from "grammy";
import type { BotContext } from "../context.ts";

export const rateLimit = limit({
  timeFrame: 2000,
  limit: 4,
  keyGenerator: (ctx: Context) => {
    const c = ctx as BotContext;
    if (c.preCheckoutQuery) return undefined;
    if (c.message?.successful_payment) return undefined;
    return c.from?.id.toString();
  },
  onLimitExceeded: (ctx: Context) => {
    const typed = ctx as BotContext;
    void (async () => {
      if (typed.callbackQuery) {
        await typed.answerCallbackQuery({ text: typed.t("rate-limited") });
        return;
      }
      if (typed.chat) await typed.reply(typed.t("rate-limited"));
    })();
  },
});
