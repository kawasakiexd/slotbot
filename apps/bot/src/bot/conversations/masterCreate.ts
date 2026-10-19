import { InlineKeyboard } from "grammy";
import { createMaster, listServices } from "../../services/catalog.ts";
import { HOUR_PRESETS, setHours } from "../../services/schedule.ts";
import type { BotConversation, ConvContext } from "../context.ts";

export async function masterCreate(conversation: BotConversation, ctx: ConvContext): Promise<void> {
  await ctx.reply(ctx.t("ask-name-en"));
  const en = (await conversation.waitFor("message:text")).message.text.trim();
  if (en.startsWith("/")) {
    await ctx.reply(ctx.t("input-cancelled"));
    return;
  }
  const skipKb = new InlineKeyboard().text(ctx.t("skip"), "skip");
  await ctx.reply(ctx.t("ask-name-ru"), { reply_markup: skipKb });
  const ruCtx = await conversation.wait();
  let nameRu: string | null = null;
  if (ruCtx.callbackQuery?.data === "skip") await ruCtx.answerCallbackQuery();
  else if (ruCtx.message?.text && !ruCtx.message.text.startsWith("/"))
    nameRu = ruCtx.message.text.trim();

  const services = await conversation.external(() => listServices());
  const selected = new Set<number>();
  while (true) {
    const kb = new InlineKeyboard();
    for (const s of services) {
      const mark = selected.has(s.id) ? "✓ " : "";
      kb.text(`${mark}${s.titleEn}`, `s:${s.id}`).row();
    }
    kb.text(ctx.t("done"), "done");
    await ctx.reply(ctx.t("pick-services"), { reply_markup: kb });
    const pick = await conversation.waitFor("callback_query:data");
    await pick.answerCallbackQuery();
    if (pick.callbackQuery.data === "done") break;
    const id = Number(pick.callbackQuery.data.replace("s:", ""));
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
  }

  const master = await conversation.external(() =>
    createMaster({ nameEn: en, nameRu, serviceIds: [...selected] }),
  );
  const preset = HOUR_PRESETS[2];
  if (preset?.startMin != null && preset.endMin != null) {
    for (const wd of [1, 2, 3, 4, 5, 6]) {
      await conversation.external(() =>
        setHours(master.id, wd, { startMin: preset.startMin!, endMin: preset.endMin! }),
      );
    }
  }
  await ctx.reply(ctx.t("new-master-done"));
}
