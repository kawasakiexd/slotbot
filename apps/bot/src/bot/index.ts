import { autoRetry } from "@grammyjs/auto-retry";
import { conversations } from "@grammyjs/conversations";
import { sequentialize } from "@grammyjs/runner";
import { Bot, GrammyError } from "grammy";
import { env } from "../config/env.ts";
import { createKvStorage } from "../db/kvStorage.ts";
import { logger } from "../logger.ts";
import { CONVERSATION_VERSION, registerConversations } from "./conversations/index.ts";
import type { BotContext } from "./context.ts";
import { i18n, menuButton } from "./i18n.ts";
import { adminComposer } from "./admin/index.ts";
import { registerAi } from "./handlers/ai.ts";
import { registerBooking } from "./handlers/booking.ts";
import { registerChatMember } from "./handlers/chatMember.ts";
import { registerFallback } from "./handlers/fallback.ts";
import { registerInfo } from "./handlers/info.ts";
import { registerMyBookings } from "./handlers/myBookings.ts";
import { registerPayments } from "./handlers/payments.ts";
import { registerReschedule } from "./handlers/reschedule.ts";
import { registerSettings } from "./handlers/settings.ts";
import { registerStart } from "./handlers/start.ts";
import { privateOnly } from "./middlewares/privateOnly.ts";
import { rateLimit } from "./middlewares/rateLimit.ts";
import { userMiddleware } from "./middlewares/user.ts";

const log = logger.child({ module: "bot" });

export function createBot(): Bot<BotContext> {
  const bot = new Bot<BotContext>(env.BOT_TOKEN);
  bot.api.config.use(autoRetry({ maxRetryAttempts: 3, maxDelaySeconds: 30 }));

  bot.use(
    sequentialize((ctx) => {
      if (ctx.preCheckoutQuery) return undefined;
      return ctx.chat?.id.toString() ?? ctx.from?.id.toString();
    }),
  );

  bot.use(async (ctx, next) => {
    const start = Date.now();
    await next();
    log.debug(
      {
        updateId: ctx.update.update_id,
        userId: ctx.from?.id,
        type: Object.keys(ctx.update).filter((k) => k !== "update_id")[0],
        ms: Date.now() - start,
      },
      "update",
    );
  });

  bot.use(privateOnly);
  bot.use(rateLimit);
  bot.use(userMiddleware);
  bot.use(i18n);

  registerPayments(bot);
  registerChatMember(bot);

  bot.use(
    conversations({
      storage: {
        type: "key",
        version: CONVERSATION_VERSION,
        adapter: createKvStorage(),
      },
      plugins: [i18n],
    }),
  );

  bot.command("cancel", async (ctx) => {
    await ctx.conversation.exitAll();
    await ctx.reply(ctx.t("input-cancelled"));
  });
  bot.filter(menuButton("flow-cancel")).use(async (ctx) => {
    await ctx.conversation.exitAll();
    await ctx.reply(ctx.t("input-cancelled"));
  });
  bot.filter(menuButton("cancel")).use(async (ctx) => {
    await ctx.conversation.exitAll();
    await ctx.reply(ctx.t("input-cancelled"));
  });

  registerConversations(bot);
  registerStart(bot);
  registerInfo(bot);
  registerSettings(bot);
  registerBooking(bot);
  registerReschedule(bot);
  registerMyBookings(bot);
  bot.use(adminComposer());
  registerAi(bot);
  registerFallback(bot);

  bot.catch((err) => {
    const ctx = err.ctx;
    log.error(
      {
        err: err.error,
        updateId: ctx.update.update_id,
        userId: ctx.from?.id,
        updateType: Object.keys(ctx.update).filter((k) => k !== "update_id")[0],
      },
      "bot error",
    );
    const text = ctx.t?.("error-generic") ?? "Something went wrong on our side. Please try again.";
    void (async () => {
      try {
        if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text, show_alert: true });
        else if (ctx.chat) await ctx.reply(text);
      } catch (e) {
        if (e instanceof GrammyError) return;
      }
    })();
  });

  return bot;
}
