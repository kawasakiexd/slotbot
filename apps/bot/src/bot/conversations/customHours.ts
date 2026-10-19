import { parseCustomHours, setHours } from "../../services/schedule.ts";
import type { BotConversation, ConvContext } from "../context.ts";

export async function customHours(
  conversation: BotConversation,
  ctx: ConvContext,
  args: { masterId: number; weekday: number },
): Promise<void> {
  await ctx.reply(ctx.t("ask-hours"));
  const { message } = await conversation.waitFor("message:text");
  const parsed = parseCustomHours(message.text);
  if (!parsed) {
    await ctx.reply(ctx.t("custom-hours-bad"));
    return;
  }
  const count = await conversation.external(() => setHours(args.masterId, args.weekday, parsed));
  await ctx.reply(ctx.t("hours-saved", { count }));
}
