import type { Conversation, ConversationFlavor } from "@grammyjs/conversations";
import type { I18nFlavor } from "@grammyjs/i18n";
import type { Context } from "grammy";
import type { UserRow } from "../db/schema.ts";

export type Role = "owner" | "demo" | null;

export interface StateFlavor {
  state: { user?: UserRow; role: Role };
}

export type BaseContext = Context & I18nFlavor & StateFlavor;
export type BotContext = ConversationFlavor<BaseContext>;
export type ConvContext = Context & I18nFlavor;
export type BotConversation = Conversation<BotContext, ConvContext>;

export function getUser(ctx: BotContext): UserRow {
  if (!ctx.state.user) throw new Error("user middleware did not load ctx.state.user");
  return ctx.state.user;
}

export function getRole(ctx: BotContext): Role {
  return ctx.state.role;
}
