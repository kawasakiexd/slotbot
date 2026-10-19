import { InlineKeyboard } from "grammy";
import { listRecipientIds, sendBroadcast } from "../../services/broadcast.ts";
import { asViewer } from "../../services/roles.ts";
import type { BotConversation, ConvContext } from "../context.ts";

export async function broadcastCompose(
  conversation: BotConversation,
  ctx: ConvContext,
): Promise<void> {
  await ctx.reply(ctx.t("broadcast-prompt"));
  const { message } = await conversation.waitFor("message:text");
  const text = message.text.trim();
  if (text.startsWith("/")) {
    await ctx.reply(ctx.t("input-cancelled"));
    return;
  }
  if (text.length > 1000) {
    await ctx.reply(ctx.t("text-too-long", { max: 1000 }));
    return;
  }
  const user = await conversation.external((oc) => oc.state.user);
  if (!user) return;
  const viewer = asViewer(user);
  if (!viewer) return;
  const recipients = await conversation.external(() => listRecipientIds(viewer));
  const preview =
    `${ctx.t("broadcast-preview", { text, count: recipients.length })}` +
    (viewer.role === "demo" ? `\n${ctx.t("broadcast-demo")}` : "");
  const kb = new InlineKeyboard()
    .text(ctx.t("broadcast-send"), "send")
    .success()
    .text(ctx.t("cancel"), "cancel");
  await ctx.reply(preview, { reply_markup: kb });
  const decide = await conversation.waitFor("callback_query:data");
  await decide.answerCallbackQuery();
  if (decide.callbackQuery.data !== "send") {
    await ctx.reply(ctx.t("input-cancelled"));
    return;
  }
  const result = await conversation.external((oc) => sendBroadcast(oc.api, viewer, text));
  await ctx.reply(ctx.t("broadcast-done", { sent: result.sent, failed: result.failed }));
}
