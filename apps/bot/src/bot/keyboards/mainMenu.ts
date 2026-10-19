import { Keyboard } from "grammy";
import { i18n, type resolveLocale } from "../i18n.ts";
import type { Role } from "../context.ts";

type Locale = ReturnType<typeof resolveLocale>;

export function mainMenuKeyboard(locale: Locale, role: Role): Keyboard {
  const kb = new Keyboard()
    .text(i18n.t(locale, "menu-book"))
    .row()
    .text(i18n.t(locale, "menu-my"))
    .text(i18n.t(locale, "menu-ask"))
    .row()
    .text(i18n.t(locale, "menu-about"))
    .text(i18n.t(locale, "menu-settings"));
  if (role) kb.row().text(i18n.t(locale, "menu-admin"));
  return kb.resized().persistent();
}

export function menuExtra(locale: Locale, role: Role) {
  return { reply_markup: mainMenuKeyboard(locale, role), parse_mode: "HTML" as const };
}

export function flowKeyboard(locale: Locale): Keyboard {
  return new Keyboard().text(i18n.t(locale, "flow-cancel")).resized();
}

export function phoneKeyboard(locale: Locale): Keyboard {
  return new Keyboard()
    .requestContact(i18n.t(locale, "phone-button"))
    .row()
    .text(i18n.t(locale, "flow-cancel"))
    .resized();
}
