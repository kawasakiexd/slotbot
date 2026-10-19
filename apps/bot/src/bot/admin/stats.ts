import type { Composer } from "grammy";
import { InlineKeyboard } from "grammy";
import { formatMoney } from "../../lib/format.ts";
import { bar, getStats, type StatsPeriod } from "../../services/stats.ts";
import { getUser, type BotContext } from "../context.ts";
import { cb, decode } from "../callbacks.ts";
import { resolveLocale } from "../i18n.ts";
import { displayName } from "../i18n.ts";
import { showScreen } from "../views/screen.ts";

export function registerAdminStats(bot: Composer<BotContext>): void {
  bot.on("callback_query:data", async (ctx, next) => {
    const route = decode(ctx.callbackQuery.data);
    if (route?.t === "ad.st") return showStats(ctx, route.per);
    return next();
  });
}

async function showStats(ctx: BotContext, per: StatsPeriod): Promise<void> {
  const locale = resolveLocale(getUser(ctx));
  const stats = await getStats(per);
  const maxS = Math.max(1, ...stats.topServices.map((s) => s.count));
  const svcList = stats.topServices
    .map(
      (s, i) =>
        `${i + 1}) ${displayName(locale, s.nameEn, s.nameRu)} ${s.count} ${bar(s.count, maxS)}`,
    )
    .join("  ");
  const mstList = stats.topMasters
    .map((m, i) => `${i + 1}) ${displayName(locale, m.nameEn, m.nameRu)} ${m.count}`)
    .join("  ");
  const text = [
    ctx.t("stats-title", { from: stats.from, to: stats.to }),
    ctx.t("stats-bookings", {
      total: stats.total,
      completed: stats.completed,
      noshow: stats.noshow,
      cancelled: stats.cancelled,
      upcoming: stats.upcoming,
    }),
    ctx.t("stats-revenue", { revenue: formatMoney(stats.revenueMinor, locale) }),
    ctx.t("stats-deposits", {
      collected: formatMoney(stats.depositsMinor, locale),
      pending: formatMoney(stats.refundsPendingMinor, locale),
    }),
    ctx.t("stats-noshow", { rate: stats.noshowRate }),
    ctx.t("stats-top-services", { list: svcList || "—" }),
    ctx.t("stats-top-masters", { list: mstList || "—" }),
    ctx.t("stats-new-clients", { count: stats.newClients }),
  ].join("\n");
  const kb = new InlineKeyboard()
    .text(ctx.t("period-7"), cb({ t: "ad.st", per: "7" }))
    .text(ctx.t("period-30"), cb({ t: "ad.st", per: "30" }))
    .text(ctx.t("period-month"), cb({ t: "ad.st", per: "m" }))
    .row()
    .text(ctx.t("admin-back"), cb({ t: "ad.h" }));
  await showScreen(ctx, { text, keyboard: kb });
}
