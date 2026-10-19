import {
  createService,
  createMaster,
  updateMaster,
  updateService,
} from "../../services/catalog.ts";
import type { BotConversation, ConvContext } from "../context.ts";

export type EditField =
  | { kind: "svc-title-en"; id: number }
  | { kind: "svc-title-ru"; id: number }
  | { kind: "svc-price"; id: number }
  | { kind: "mst-name-en"; id: number }
  | { kind: "mst-name-ru"; id: number };

export async function editText(
  conversation: BotConversation,
  ctx: ConvContext,
  field: EditField,
): Promise<void> {
  const prompt =
    field.kind === "svc-price"
      ? ctx.t("ask-price", { currency: "USD" })
      : field.kind.startsWith("mst")
        ? ctx.t("ask-name-en")
        : ctx.t("ask-title-en");
  await ctx.reply(prompt);
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
  await conversation.external(async () => {
    if (field.kind === "svc-title-en") await updateService(field.id, { titleEn: text });
    if (field.kind === "svc-title-ru") await updateService(field.id, { titleRu: text });
    if (field.kind === "mst-name-en") await updateMaster(field.id, { nameEn: text });
    if (field.kind === "mst-name-ru") await updateMaster(field.id, { nameRu: text });
    if (field.kind === "svc-price") {
      const n = Number(text.replace(",", "."));
      if (!Number.isFinite(n) || n < 0) throw new Error("bad-number");
      await updateService(field.id, { priceMinor: Math.round(n * 100) });
    }
  });
  await ctx.reply(ctx.t("edit-saved"));
  void createService;
  void createMaster;
}
