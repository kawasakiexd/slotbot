import { createConversation } from "@grammyjs/conversations";
import type { Bot } from "grammy";
import type { BotContext } from "../context.ts";
import { broadcastCompose } from "./broadcastCompose.ts";
import { customHours } from "./customHours.ts";
import { editText } from "./editText.ts";
import { masterCreate } from "./masterCreate.ts";
import { serviceCreate } from "./serviceCreate.ts";

export const CONVERSATION_VERSION = 1;

export function registerConversations(bot: Bot<BotContext>): void {
  bot.use(createConversation(serviceCreate, "serviceCreate"));
  bot.use(createConversation(masterCreate, "masterCreate"));
  bot.use(createConversation(editText, "editText"));
  bot.use(createConversation(customHours, "customHours"));
  bot.use(createConversation(broadcastCompose, "broadcastCompose"));
}
