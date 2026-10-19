import type { Composer } from "grammy";
import { InlineKeyboard } from "grammy";
import { DateTime } from "luxon";
import { formatHm } from "../../lib/format.ts";
import { HOUR_PRESETS, hoursForMaster, setHours } from "../../services/schedule.ts";
import { listMasters, masterName } from "../../services/catalog.ts";
import { getUser, type BotContext } from "../context.ts";
import { cb, decode } from "../callbacks.ts";
import { resolveLocale } from "../i18n.ts";
import { showScreen, toast } from "../views/screen.ts";
import { salonZone } from "../../lib/time.ts";

export function registerAdminHours(bot: Composer<BotContext>): void {
  bot.on("callback_query:data", async (ctx, next) => {
    const route = decode(ctx.callbackQuery.data);
    if (!route) return next();
    if (route.t === "ad.hrs") return showMasters(ctx);
    if (route.t === "ad.hrm") return showMasterHours(ctx, route.mst);
    if (route.t === "ad.hrd") return showWeekday(ctx, route.mst, route.wd);
    if (route.t === "ad.hrp") {
      const preset = HOUR_PRESETS.find((p) => p.id === route.p);
      const window =
        preset && preset.startMin != null && preset.endMin != null
          ? { startMin: preset.startMin, endMin: preset.endMin }
          : null;
      const count = await setHours(route.mst, route.wd, window);
      await toast(ctx, ctx.t("hours-saved", { count }), false);
      return showMasterHours(ctx, route.mst);
    }
    if (route.t === "ad.hrc") {
      await ctx.conversation.enter("customHours", { masterId: route.mst, weekday: route.wd });
      await ctx.answerCallbackQuery();
      return;
    }
    return next();
  });
}

async function showMasters(ctx: BotContext): Promise<void> {
  const locale = resolveLocale(getUser(ctx));
  const list = await listMasters();
  const kb = new InlineKeyboard();
  for (const m of list) {
    kb.text(masterName(m, locale), cb({ t: "ad.hrm", mst: m.id })).row();
  }
  kb.text(ctx.t("admin-back"), cb({ t: "ad.h" }));
  await showScreen(ctx, { text: ctx.t("hours-pick-master"), keyboard: kb });
}

export async function showMasterHours(ctx: BotContext, masterId: number): Promise<void> {
  const locale = resolveLocale(getUser(ctx));
  const master = (await listMasters()).find((m) => m.id === masterId);
  const hours = await hoursForMaster(masterId);
  const map = new Map(hours.map((h) => [h.weekday, h]));
  const kb = new InlineKeyboard();
  const lines = [ctx.t("hours-master", { master: master ? masterName(master, locale) : "" })];
  for (let wd = 1; wd <= 7; wd++) {
    const day = DateTime.fromObject(
      { weekday: wd as 1 | 2 | 3 | 4 | 5 | 6 | 7 },
      { zone: salonZone() },
    )
      .setLocale(locale.startsWith("ru") ? "ru" : "en")
      .toFormat("ccc");
    const h = map.get(wd);
    const label = h ? `${formatHm(h.startMin)}–${formatHm(h.endMin)}` : ctx.t("hours-off");
    lines.push(ctx.t("weekday-line", { day, hours: label }));
    kb.text(`${day} ${label}`, cb({ t: "ad.hrd", mst: masterId, wd })).row();
  }
  kb.text(ctx.t("back"), cb({ t: "ad.hrs" }));
  await showScreen(ctx, { text: lines.join("\n"), keyboard: kb });
}

async function showWeekday(ctx: BotContext, masterId: number, wd: number): Promise<void> {
  const kb = new InlineKeyboard();
  for (const p of HOUR_PRESETS) {
    kb.text(p.label, cb({ t: "ad.hrp", mst: masterId, wd, p: p.id })).row();
  }
  kb.text(ctx.t("hours-custom"), cb({ t: "ad.hrc", mst: masterId, wd })).row();
  kb.text(ctx.t("back"), cb({ t: "ad.hrm", mst: masterId }));
  await showScreen(ctx, { text: ctx.t("edit-hours"), keyboard: kb });
}
