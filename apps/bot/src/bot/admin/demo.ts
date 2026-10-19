import type { Composer } from "grammy";
import { InlineKeyboard } from "grammy";
import { env } from "../../config/env.ts";
import { kvGet, kvSet } from "../../db/kvStorage.ts";
import { DomainError } from "../../lib/errors.ts";
import { restoreCatalog } from "../../services/demo.ts";
import { getUser, type BotContext } from "../context.ts";
import { cb, decode } from "../callbacks.ts";
import { tv } from "../i18n.ts";
import { showScreen, toast } from "../views/screen.ts";

const RESTORE_KEY = "app:demo:lastRestoreAt";

export function registerAdminDemo(bot: Composer<BotContext>): void {
  bot.on("callback_query:data", async (ctx, next) => {
    const route = decode(ctx.callbackQuery.data);
    if (route?.t === "ad.rs") return confirmRestore(ctx);
    if (route?.t === "ad.rsok") return doRestore(ctx);
    return next();
  });
}

async function confirmRestore(ctx: BotContext): Promise<void> {
  const kb = new InlineKeyboard()
    .text(ctx.t("restore-yes"), cb({ t: "ad.rsok" }))
    .danger()
    .text(ctx.t("cancel"), cb({ t: "ad.h" }));
  await showScreen(ctx, { text: ctx.t("restore-confirm"), keyboard: kb });
}

async function doRestore(ctx: BotContext): Promise<void> {
  void getUser;
  const last = await kvGet<number>(RESTORE_KEY);
  const now = Date.now();
  if (last) {
    const elapsed = Math.floor((now - last) / 60_000);
    if (elapsed < env.DEMO_RESTORE_COOLDOWN_MINUTES) {
      throw new DomainError("COOLDOWN", {
        ago: elapsed,
        left: env.DEMO_RESTORE_COOLDOWN_MINUTES - elapsed,
      });
    }
  }
  try {
    await restoreCatalog();
    await kvSet(RESTORE_KEY, now);
    await toast(ctx, ctx.t("restore-done"), false);
    const { showAdminHome } = await import("./index.ts");
    await showAdminHome(ctx);
  } catch (err) {
    if (err instanceof DomainError) {
      await toast(ctx, ctx.t("error-cooldown", tv(err.meta)));
      return;
    }
    throw err;
  }
}
