import type { Composer } from "grammy";
import { InlineKeyboard, InputFile } from "grammy";
import { buildBookingsXlsx } from "../../services/exportXlsx.ts";
import { asViewer } from "../../services/roles.ts";
import type { StatsPeriod } from "../../services/stats.ts";
import { getUser, type BotContext } from "../context.ts";
import { cb, decode } from "../callbacks.ts";
import { resolveLocale } from "../i18n.ts";
import { showScreen } from "../views/screen.ts";

export function registerAdminExport(bot: Composer<BotContext>): void {
  bot.on("callback_query:data", async (ctx, next) => {
    const route = decode(ctx.callbackQuery.data);
    if (route?.t === "ad.ex") return doExport(ctx, route.per);
    return next();
  });
}

async function doExport(ctx: BotContext, per: StatsPeriod): Promise<void> {
  const viewer = asViewer(getUser(ctx));
  if (!viewer) return;
  const locale = resolveLocale(getUser(ctx));
  const kb = new InlineKeyboard()
    .text(ctx.t("period-7"), cb({ t: "ad.ex", per: "7" }))
    .text(ctx.t("period-30"), cb({ t: "ad.ex", per: "30" }))
    .text(ctx.t("period-month"), cb({ t: "ad.ex", per: "m" }))
    .row()
    .text(ctx.t("admin-back"), cb({ t: "ad.h" }));
  await showScreen(ctx, { text: ctx.t("admin-export"), keyboard: kb });
  const { buffer, filename } = await buildBookingsXlsx(per, locale, viewer);
  await ctx.replyWithDocument(new InputFile(buffer, filename), {
    caption: ctx.t("export-caption"),
  });
}
