import type { Composer } from "grammy";
import { InlineKeyboard } from "grammy";
import { env } from "../../config/env.ts";
import { DomainError, errorKey, isDomainError } from "../../lib/errors.ts";
import { askAssistant } from "../../services/ai/assistant.ts";
import { questionsLeft } from "../../services/ai/usage.ts";
import { getUser, type BotContext } from "../context.ts";
import { cb } from "../callbacks.ts";
import { showServices } from "./booking.ts";
import { showMasters } from "./booking.ts";

export function registerAi(bot: Composer<BotContext>): void {
  bot.on("message:text", async (ctx, next) => {
    const text = ctx.message.text;
    if (text.startsWith("/")) return next();
    if (ctx.message.reply_to_message?.contact) return next();
    await handleQuestion(ctx, text);
  });

  bot.on("callback_query:data", async (ctx, next) => {
    if (!ctx.callbackQuery.data.startsWith("ai:book")) return next();
    const { decode } = await import("../callbacks.ts");
    const route = decode(ctx.callbackQuery.data);
    if (route?.t === "ai.book") {
      if (route.svc > 0) {
        const { showMasters: sm } = await import("./booking.ts");
        await sm(ctx, route.svc);
      } else {
        await showServices(ctx);
      }
      return;
    }
    return next();
  });
}

export async function showAiIntro(ctx: BotContext): Promise<void> {
  const user = getUser(ctx);
  if (!env.OPENAI_API_KEY) {
    await ctx.reply(ctx.t("ai-disabled"));
    return;
  }
  const left = await questionsLeft(user.id);
  await ctx.reply(ctx.t("ai-intro", { left }));
}

async function handleQuestion(ctx: BotContext, text: string): Promise<void> {
  const user = getUser(ctx);
  try {
    await ctx.replyWithChatAction("typing");
    const note = text.length > 500 ? `${ctx.t("ai-truncated")}\n` : "";
    const result = await askAssistant({
      userId: user.id,
      telegramId: user.telegramId,
      question: text,
    });
    let answer = result.answer;
    if (result.intent === "off_topic") answer = ctx.t("ai-offtopic");
    const kb = new InlineKeyboard();
    if (result.intent === "booking") {
      kb.text(ctx.t("ai-book-now"), cb({ t: "ai.book", svc: result.serviceId ?? 0 }));
    }
    await ctx.reply(note + answer, { reply_markup: kb });
  } catch (err) {
    if (isDomainError(err)) {
      await ctx.reply(
        ctx.t(errorKey(err.code), {
          ...err.meta,
          tz: env.SALON_TIMEZONE,
          limit: env.AI_USER_DAILY_LIMIT,
        }),
      );
      return;
    }
    await ctx.reply(ctx.t("ai-error"));
  }
}

void DomainError;
void showMasters;
