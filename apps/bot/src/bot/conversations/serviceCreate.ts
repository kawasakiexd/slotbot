import { InlineKeyboard } from "grammy";
import { DEPOSIT_PERCENTS } from "@slotbot/shared";
import { createService, listMasters } from "../../services/catalog.ts";
import { toMinor } from "@slotbot/shared";
import type { BotConversation, ConvContext } from "../context.ts";

export async function serviceCreate(
  conversation: BotConversation,
  ctx: ConvContext,
): Promise<void> {
  await ctx.reply(ctx.t("ask-title-en"));
  const en = (await conversation.waitFor("message:text")).message.text.trim();
  if (en.startsWith("/")) {
    await ctx.reply(ctx.t("input-cancelled"));
    return;
  }
  const skipKb = new InlineKeyboard().text(ctx.t("skip"), "skip");
  await ctx.reply(ctx.t("ask-title-ru"), { reply_markup: skipKb });
  const ruCtx = await conversation.wait();
  let titleRu: string | null = null;
  if (ruCtx.callbackQuery?.data === "skip") {
    await ruCtx.answerCallbackQuery();
  } else if (ruCtx.message?.text && !ruCtx.message.text.startsWith("/")) {
    titleRu = ruCtx.message.text.trim();
  }

  const durKb = new InlineKeyboard();
  for (const min of [15, 30, 45, 60, 75, 90, 120, 180]) {
    durKb.text(ctx.t("duration-min", { min }), `dur:${min}`);
    if (min === 60) durKb.row();
  }
  await ctx.reply(ctx.t("edit-duration"), { reply_markup: durKb });
  const durCtx = await conversation.waitFor("callback_query:data");
  await durCtx.answerCallbackQuery();
  const durationMin = Number(durCtx.callbackQuery.data.replace("dur:", ""));

  await ctx.reply(ctx.t("ask-price", { currency: "USD" }));
  const priceText = (await conversation.waitFor("message:text")).message.text.trim();
  const price = Number(priceText.replace(",", "."));
  if (!Number.isFinite(price) || price < 0) {
    await ctx.reply(ctx.t("number-bad"));
    return;
  }

  const depKb = new InlineKeyboard();
  for (const pct of DEPOSIT_PERCENTS) {
    depKb.text(ctx.t("deposit-pct", { pct }), `dep:${pct}`);
  }
  await ctx.reply(ctx.t("edit-deposit"), { reply_markup: depKb });
  const depCtx = await conversation.waitFor("callback_query:data");
  await depCtx.answerCallbackQuery();
  const prepayPercent = Number(depCtx.callbackQuery.data.replace("dep:", ""));

  const masters = await conversation.external(() => listMasters());
  const selected = new Set<number>();
  while (true) {
    const kb = new InlineKeyboard();
    for (const m of masters) {
      const mark = selected.has(m.id) ? "✓ " : "";
      kb.text(`${mark}${m.nameEn}`, `m:${m.id}`).row();
    }
    kb.text(ctx.t("done"), "done");
    await ctx.reply(ctx.t("pick-masters"), { reply_markup: kb });
    const pick = await conversation.waitFor("callback_query:data");
    await pick.answerCallbackQuery();
    if (pick.callbackQuery.data === "done") break;
    const id = Number(pick.callbackQuery.data.replace("m:", ""));
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
  }

  await conversation.external(() =>
    createService({
      titleEn: en,
      titleRu,
      durationMin,
      priceMinor: toMinor(price),
      prepayPercent,
      masterIds: [...selected],
    }),
  );
  await ctx.reply(ctx.t("new-service-done"));
}
