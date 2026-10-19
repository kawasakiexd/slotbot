import type { Composer } from "grammy";
import { InlineKeyboard } from "grammy";
import { DEPOSIT_PERCENTS } from "@slotbot/shared";
import { formatMoney } from "../../lib/format.ts";
import { isDomainError, errorKey } from "../../lib/errors.ts";
import {
  getService,
  listMasters,
  listServices,
  mastersForService,
  serviceTitle,
  setServiceActive,
  toggleServiceMaster,
} from "../../services/catalog.ts";
import { asViewer } from "../../services/roles.ts";
import { getUser, type BotContext } from "../context.ts";
import { cb, decode } from "../callbacks.ts";
import { resolveLocale, tv } from "../i18n.ts";
import { showScreen, toast } from "../views/screen.ts";

export function registerAdminServices(bot: Composer<BotContext>): void {
  bot.on("callback_query:data", async (ctx, next) => {
    const route = decode(ctx.callbackQuery.data);
    if (!route) return next();
    const viewer = asViewer(getUser(ctx));
    if (!viewer) return next();
    try {
      if (route.t === "ad.svc") return showList(ctx);
      if (route.t === "ad.svn") {
        await ctx.conversation.enter("serviceCreate");
        await ctx.answerCallbackQuery();
        return;
      }
      if (route.t === "ad.sv") return showCard(ctx, route.id);
      if (route.t === "ad.svt") {
        await ctx.conversation.enter("editText", { kind: "svc-title-en", id: route.id });
        await ctx.answerCallbackQuery();
        return;
      }
      if (route.t === "ad.svp") {
        await ctx.conversation.enter("editText", { kind: "svc-price", id: route.id });
        await ctx.answerCallbackQuery();
        return;
      }
      if (route.t === "ad.svd") return showDuration(ctx, route.id);
      if (route.t === "ad.svds") {
        const { updateService } = await import("../../services/catalog.ts");
        await updateService(route.id, { durationMin: route.min });
        await toast(ctx, ctx.t("edit-saved"), false);
        return showCard(ctx, route.id);
      }
      if (route.t === "ad.svdep") return showDeposit(ctx, route.id);
      if (route.t === "ad.svdeps") {
        const { updateService } = await import("../../services/catalog.ts");
        await updateService(route.id, { prepayPercent: route.pct });
        await toast(ctx, ctx.t("edit-saved"), false);
        return showCard(ctx, route.id);
      }
      if (route.t === "ad.svm") return showSvcMasters(ctx, route.id);
      if (route.t === "ad.svmt") {
        await toggleServiceMaster(route.id, route.mst);
        return showSvcMasters(ctx, route.id);
      }
      if (route.t === "ad.sva") {
        const svc = await getService(route.id);
        if (!svc) return;
        await setServiceActive(viewer, route.id, !svc.isActive);
        return showCard(ctx, route.id);
      }
    } catch (err) {
      if (isDomainError(err)) {
        await toast(ctx, ctx.t(errorKey(err.code), tv(err.meta)));
        return;
      }
      throw err;
    }
    return next();
  });
}

async function showList(ctx: BotContext): Promise<void> {
  const locale = resolveLocale(getUser(ctx));
  const list = await listServices();
  const kb = new InlineKeyboard();
  for (const s of list) {
    kb.text(
      `${s.isActive ? "🟢" : "⚪️"} ${serviceTitle(s, locale)}`,
      cb({ t: "ad.sv", id: s.id }),
    ).row();
  }
  kb.text(ctx.t("svc-new"), cb({ t: "ad.svn" })).row();
  kb.text(ctx.t("admin-back"), cb({ t: "ad.h" }));
  await showScreen(ctx, { text: ctx.t("svc-list"), keyboard: kb });
}

async function showCard(ctx: BotContext, id: number): Promise<void> {
  const locale = resolveLocale(getUser(ctx));
  const svc = await getService(id);
  if (!svc) return;
  const text = [
    `${svc.isActive ? "🟢" : "⚪️"} ${serviceTitle(svc, locale)}`,
    `${svc.durationMin} min · ${formatMoney(svc.priceMinor, locale)} · ${svc.prepayPercent}%`,
  ].join("\n");
  const kb = new InlineKeyboard()
    .text(ctx.t("edit-title"), cb({ t: "ad.svt", id }))
    .text(ctx.t("edit-price"), cb({ t: "ad.svp", id }))
    .row()
    .text(ctx.t("edit-duration"), cb({ t: "ad.svd", id }))
    .text(ctx.t("edit-deposit"), cb({ t: "ad.svdep", id }))
    .row()
    .text(ctx.t("edit-masters"), cb({ t: "ad.svm", id }))
    .row()
    .text(svc.isActive ? ctx.t("active-on") : ctx.t("active-off"), cb({ t: "ad.sva", id }))
    .row()
    .text(ctx.t("back"), cb({ t: "ad.svc" }));
  await showScreen(ctx, { text, keyboard: kb });
}

async function showDuration(ctx: BotContext, id: number): Promise<void> {
  const kb = new InlineKeyboard();
  for (const min of [15, 30, 45, 60, 75, 90, 120, 180, 240]) {
    kb.text(ctx.t("duration-min", { min }), cb({ t: "ad.svds", id, min }));
    if (min % 60 === 0) kb.row();
  }
  kb.row().text(ctx.t("back"), cb({ t: "ad.sv", id }));
  await showScreen(ctx, { text: ctx.t("edit-duration"), keyboard: kb });
}

async function showDeposit(ctx: BotContext, id: number): Promise<void> {
  const kb = new InlineKeyboard();
  for (const pct of DEPOSIT_PERCENTS) {
    kb.text(ctx.t("deposit-pct", { pct }), cb({ t: "ad.svdeps", id, pct }));
  }
  kb.row().text(ctx.t("back"), cb({ t: "ad.sv", id }));
  await showScreen(ctx, { text: ctx.t("edit-deposit"), keyboard: kb });
}

async function showSvcMasters(ctx: BotContext, id: number): Promise<void> {
  const locale = resolveLocale(getUser(ctx));
  const assigned = new Set((await mastersForService(id, false)).map((m) => m.id));
  const all = await listMasters();
  const kb = new InlineKeyboard();
  for (const m of all) {
    kb.text(
      `${assigned.has(m.id) ? "✓ " : ""}${m.nameEn}`,
      cb({ t: "ad.svmt", id, mst: m.id }),
    ).row();
  }
  kb.text(ctx.t("done"), cb({ t: "ad.sv", id }));
  await showScreen(ctx, { text: ctx.t("pick-masters"), keyboard: kb });
  void locale;
}
