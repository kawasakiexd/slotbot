import { I18n, type TranslationVariables } from "@grammyjs/i18n";
import { LOCALES, type Locale } from "@slotbot/shared";
import type { UserRow } from "../db/schema.ts";
import { localesDir } from "../lib/paths.ts";
import type { BotContext } from "./context.ts";

export function tv(vars: Record<string, unknown> = {}): TranslationVariables {
  return vars as TranslationVariables;
}

export const i18n = new I18n<BotContext>({
  defaultLocale: "en",
  directory: localesDir(),
  fluentBundleOptions: { useIsolating: false },
  localeNegotiator: (ctx) => resolveLocale(ctx.state.user),
});

export function resolveLocale(user?: Pick<UserRow, "locale" | "languageCode"> | null): Locale {
  if (user?.locale === "ru" || user?.locale === "en") return user.locale;
  if (user?.languageCode?.toLowerCase().startsWith("ru")) return "ru";
  return "en";
}

export function menuButton(key: string) {
  return (ctx: BotContext): boolean => {
    const text = ctx.message?.text;
    if (!text || text.startsWith("/")) return false;
    if (ctx.t(key) === text) return true;
    return LOCALES.some((locale) => i18n.t(locale, key) === text);
  };
}

export function displayName(locale: string, en: string, ru: string | null | undefined): string {
  return locale.startsWith("ru") && ru ? ru : en;
}
