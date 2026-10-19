import type { Composer } from "grammy";
import { InlineKeyboard } from "grammy";
import { env } from "../../config/env.ts";
import { salon } from "../../config/salon.ts";
import { getUser, type BotContext } from "../context.ts";
import { menuButton, resolveLocale } from "../i18n.ts";
import { menuExtra } from "../keyboards/mainMenu.ts";
import { cb } from "../callbacks.ts";

export function registerStart(bot: Composer<BotContext>): void {
  bot.command("start", async (ctx) => {
    const payload = ctx.match?.trim() ?? "";
    if (payload === "book") {
      const { showServices } = await import("./booking.ts");
      await showServices(ctx);
      return;
    }
    if (payload === "my") {
      const { showMyList } = await import("./myBookings.ts");
      await showMyList(ctx, 0);
      return;
    }
    const pay = /^pay-(\d+)$/.exec(payload);
    if (pay) {
      const { resendInvoice } = await import("./payments.ts");
      await resendInvoice(ctx, Number(pay[1]));
      return;
    }
    await sendWelcome(ctx);
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(ctx.t("help-text"), menuExtra(resolveLocale(getUser(ctx)), ctx.state.role));
  });

  bot.filter(menuButton("menu-book")).use(async (ctx) => {
    const { showServices } = await import("./booking.ts");
    await showServices(ctx);
  });
  bot.filter(menuButton("menu-my")).use(async (ctx) => {
    const { showMyList } = await import("./myBookings.ts");
    await showMyList(ctx, 0);
  });
  bot.filter(menuButton("menu-ask")).use(async (ctx) => {
    const { showAiIntro } = await import("./ai.ts");
    await showAiIntro(ctx);
  });
  bot.filter(menuButton("menu-about")).use(async (ctx) => {
    await replyAbout(ctx);
  });
  bot.filter(menuButton("menu-settings")).use(async (ctx) => {
    const { showSettings } = await import("./settings.ts");
    await showSettings(ctx);
  });
  bot.filter(menuButton("menu-admin")).use(async (ctx) => {
    const { showAdminHome } = await import("../admin/index.ts");
    await showAdminHome(ctx);
  });

  bot.command("book", async (ctx) => {
    const { showServices } = await import("./booking.ts");
    await showServices(ctx);
  });
  bot.command("my", async (ctx) => {
    const { showMyList } = await import("./myBookings.ts");
    await showMyList(ctx, 0);
  });
  bot.command("ask", async (ctx) => {
    const { showAiIntro } = await import("./ai.ts");
    await showAiIntro(ctx);
  });
}

export async function sendWelcome(ctx: BotContext): Promise<void> {
  const user = getUser(ctx);
  const locale = resolveLocale(user);
  let text = ctx.t("welcome", { salon: salon.name });
  const kb = new InlineKeyboard();
  if (env.DEMO_MODE) {
    text += `\n\n${ctx.t("demo-hints", { tz: salon.tzLabel[locale] })}`;
    kb.copyText(ctx.t("copy-test-card"), "4242 4242 4242 4242").row();
    kb.text(ctx.t("try-admin"), cb({ t: "ad.h" }));
  }
  await ctx.reply(text, { parse_mode: "HTML", reply_markup: kb });
  await ctx.reply("\u2060", menuExtra(locale, ctx.state.role));
}

export async function replyAbout(ctx: BotContext): Promise<void> {
  const locale = resolveLocale(getUser(ctx));
  const kb = new InlineKeyboard()
    .url(ctx.t("open-maps"), salon.mapsUrl)
    .row()
    .text(ctx.t("menu-book"), cb({ t: "bk.s" }));
  await ctx.reply(
    ctx.t("about-text", {
      salon: salon.name,
      address: salon.address,
      phone: salon.phone,
      hours: salon.hoursText[locale],
    }),
    { parse_mode: "HTML", reply_markup: kb },
  );
}
