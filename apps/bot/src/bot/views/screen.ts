import { GrammyError, InlineKeyboard } from "grammy";
import type { BotContext } from "../context.ts";

export interface Screen {
  text: string;
  keyboard?: InlineKeyboard;
  extra?: Record<string, unknown>;
}

export async function showScreen(ctx: BotContext, screen: Screen): Promise<void> {
  const extra = {
    parse_mode: "HTML" as const,
    reply_markup: screen.keyboard,
    ...screen.extra,
  };
  try {
    if (ctx.callbackQuery?.message) {
      await ctx.editMessageText(screen.text, extra);
    } else {
      await ctx.reply(screen.text, extra);
    }
  } catch (err) {
    if (err instanceof GrammyError && err.description.includes("message is not modified")) {
      // ignore
    } else if (err instanceof GrammyError && err.description.includes("message to edit")) {
      await ctx.reply(screen.text, extra);
    } else {
      throw err;
    }
  }
  if (ctx.callbackQuery) {
    try {
      await ctx.answerCallbackQuery();
    } catch (err) {
      if (err instanceof GrammyError && err.description.includes("query is too old")) return;
      throw err;
    }
  }
}

export async function toast(ctx: BotContext, text: string, alert = true): Promise<void> {
  if (ctx.callbackQuery) {
    try {
      await ctx.answerCallbackQuery({ text, show_alert: alert });
    } catch {
      await ctx.reply(text);
    }
    return;
  }
  await ctx.reply(text);
}
