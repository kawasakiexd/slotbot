import type { Composer } from "grammy";
import { InlineKeyboard, Keyboard } from "grammy";
import type { Locale } from "@slotbot/shared";
import { deleteMyData, setLocale, setPhone } from "../../services/users.ts";
import { getRole } from "../../services/roles.ts";
import { getUser, type BotContext } from "../context.ts";
import { cb, decode } from "../callbacks.ts";
import { resolveLocale } from "../i18n.ts";
import { menuExtra, phoneKeyboard } from "../keyboards/mainMenu.ts";
import { showScreen, toast } from "../views/screen.ts";

export function registerSettings(bot: Composer<BotContext>): void {
  bot.command("settings", async (ctx) => {
    await showSettings(ctx);
  });

  bot.on("callback_query:data", async (ctx, next) => {
    const route = decode(ctx.callbackQuery.data);
    if (!route || !route.t.startsWith("set.")) return next();
    if (route.t === "set.h") return showSettings(ctx);
    if (route.t === "set.lang") return showLang(ctx);
    if (route.t === "set.langset") return setLang(ctx, route.loc);
    if (route.t === "set.phone") return askPhone(ctx);
    if (route.t === "set.del") return confirmDelete(ctx);
    if (route.t === "set.delok") return doDelete(ctx);
    return next();
  });

  bot.on("message:contact", async (ctx, next) => {
    const contact = ctx.message.contact;
    if (!contact?.phone_number) return next();
    if (contact.user_id && contact.user_id !== ctx.from?.id) return next();
    await setPhone(getUser(ctx).id, contact.phone_number);
    ctx.state.user = { ...getUser(ctx), phone: contact.phone_number };
    const locale = resolveLocale(getUser(ctx));
    await ctx.reply(ctx.t("phone-saved"), menuExtra(locale, ctx.state.role));
  });
}

export async function showSettings(ctx: BotContext): Promise<void> {
  const user = getUser(ctx);
  const locale = resolveLocale(user);
  const kb = new InlineKeyboard()
    .text(ctx.t("settings-language"), cb({ t: "set.lang" }))
    .row()
    .text(ctx.t("settings-phone"), cb({ t: "set.phone" }))
    .row()
    .text(ctx.t("settings-delete"), cb({ t: "set.del" }));
  await showScreen(ctx, {
    text: ctx.t("settings-home", {
      language: locale === "ru" ? "Русский" : "English",
      phone: user.phone ?? "—",
    }),
    keyboard: kb,
  });
}

async function showLang(ctx: BotContext): Promise<void> {
  const locale = resolveLocale(getUser(ctx));
  const kb = new InlineKeyboard()
    .text(`${locale === "en" ? "✓ " : ""}${ctx.t("lang-en")}`, cb({ t: "set.langset", loc: "en" }))
    .row()
    .text(`${locale === "ru" ? "✓ " : ""}${ctx.t("lang-ru")}`, cb({ t: "set.langset", loc: "ru" }))
    .row()
    .text(ctx.t("back"), cb({ t: "set.h" }));
  await showScreen(ctx, { text: ctx.t("settings-pick-lang"), keyboard: kb });
}

async function setLang(ctx: BotContext, loc: Locale): Promise<void> {
  const updated = await setLocale(getUser(ctx).id, loc);
  ctx.state.user = updated;
  ctx.i18n.useLocale(loc);
  const role = getRole(updated);
  ctx.state.role = role;
  await ctx.reply(ctx.t("edit-saved"), menuExtra(loc, role));
  await showSettings(ctx);
}

async function askPhone(ctx: BotContext): Promise<void> {
  const locale = resolveLocale(getUser(ctx));
  await toast(ctx, ctx.t("phone-prompt"), false);
  await ctx.reply(ctx.t("phone-prompt"), { reply_markup: phoneKeyboard(locale) });
}

async function confirmDelete(ctx: BotContext): Promise<void> {
  const kb = new InlineKeyboard()
    .text(ctx.t("delete-yes"), cb({ t: "set.delok" }))
    .danger()
    .text(ctx.t("cancel"), cb({ t: "set.h" }));
  await showScreen(ctx, { text: ctx.t("delete-confirm"), keyboard: kb });
}

async function doDelete(ctx: BotContext): Promise<void> {
  await deleteMyData(getUser(ctx).id);
  await showScreen(ctx, { text: ctx.t("delete-done"), keyboard: new InlineKeyboard() });
}

void Keyboard;
