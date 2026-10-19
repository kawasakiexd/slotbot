import type { Composer } from "grammy";
import { InlineKeyboard } from "grammy";
import { isDomainError, errorKey } from "../../lib/errors.ts";
import {
  getMaster,
  listMasters,
  listServices,
  masterName,
  servicesForMaster,
  setMasterActive,
  toggleServiceMaster,
} from "../../services/catalog.ts";
import { asViewer } from "../../services/roles.ts";
import { getUser, type BotContext } from "../context.ts";
import { cb, decode } from "../callbacks.ts";
import { resolveLocale, tv } from "../i18n.ts";
import { showScreen, toast } from "../views/screen.ts";

export function registerAdminMasters(bot: Composer<BotContext>): void {
  bot.on("callback_query:data", async (ctx, next) => {
    const route = decode(ctx.callbackQuery.data);
    if (!route) return next();
    const viewer = asViewer(getUser(ctx));
    if (!viewer) return next();
    try {
      if (route.t === "ad.mst") return showList(ctx);
      if (route.t === "ad.mnw") {
        await ctx.conversation.enter("masterCreate");
        await ctx.answerCallbackQuery();
        return;
      }
      if (route.t === "ad.mv") return showCard(ctx, route.id);
      if (route.t === "ad.mn") {
        await ctx.conversation.enter("editText", { kind: "mst-name-en", id: route.id });
        await ctx.answerCallbackQuery();
        return;
      }
      if (route.t === "ad.ms") return showMstServices(ctx, route.id);
      if (route.t === "ad.mstg") {
        await toggleServiceMaster(route.svc, route.id);
        return showMstServices(ctx, route.id);
      }
      if (route.t === "ad.mh") {
        const { showMasterHours } = await import("./hours.ts");
        return showMasterHours(ctx, route.id);
      }
      if (route.t === "ad.ma") {
        const m = await getMaster(route.id);
        if (!m) return;
        await setMasterActive(viewer, route.id, !m.isActive);
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
  const list = await listMasters();
  const kb = new InlineKeyboard();
  for (const m of list) {
    kb.text(
      `${m.isActive ? "🟢" : "⚪️"} ${masterName(m, locale)}`,
      cb({ t: "ad.mv", id: m.id }),
    ).row();
  }
  kb.text(ctx.t("mst-new"), cb({ t: "ad.mnw" })).row();
  kb.text(ctx.t("admin-back"), cb({ t: "ad.h" }));
  await showScreen(ctx, { text: ctx.t("mst-list"), keyboard: kb });
}

async function showCard(ctx: BotContext, id: number): Promise<void> {
  const locale = resolveLocale(getUser(ctx));
  const m = await getMaster(id);
  if (!m) return;
  const kb = new InlineKeyboard()
    .text(ctx.t("edit-name"), cb({ t: "ad.mn", id }))
    .row()
    .text(ctx.t("edit-services"), cb({ t: "ad.ms", id }))
    .text(ctx.t("edit-hours"), cb({ t: "ad.mh", id }))
    .row()
    .text(m.isActive ? ctx.t("active-on") : ctx.t("active-off"), cb({ t: "ad.ma", id }))
    .row()
    .text(ctx.t("back"), cb({ t: "ad.mst" }));
  await showScreen(ctx, {
    text: `${m.isActive ? "🟢" : "⚪️"} ${masterName(m, locale)}`,
    keyboard: kb,
  });
}

async function showMstServices(ctx: BotContext, id: number): Promise<void> {
  const assigned = new Set((await servicesForMaster(id)).map((s) => s.id));
  const all = await listServices();
  const kb = new InlineKeyboard();
  for (const s of all) {
    kb.text(
      `${assigned.has(s.id) ? "✓ " : ""}${s.titleEn}`,
      cb({ t: "ad.mstg", id, svc: s.id }),
    ).row();
  }
  kb.text(ctx.t("done"), cb({ t: "ad.mv", id }));
  await showScreen(ctx, { text: ctx.t("pick-services"), keyboard: kb });
}
