import { InlineKeyboard } from "grammy";
import type { Route } from "../callbacks.ts";
import { cb } from "../callbacks.ts";
import { i18n } from "../i18n.ts";

export function backCancel(
  locale: string,
  back: Route,
  cancel: Route = { t: "bk.x" },
): InlineKeyboard {
  return new InlineKeyboard()
    .text(i18n.t(locale, "back"), cb(back))
    .text(i18n.t(locale, "cancel"), cb(cancel));
}

export function paginationRow(
  kb: InlineKeyboard,
  locale: string,
  page: number,
  totalPages: number,
  make: (p: number) => Route,
): InlineKeyboard {
  if (totalPages <= 1) return kb;
  if (page > 0) kb.text(i18n.t(locale, "nav-prev"), cb(make(page - 1)));
  kb.text(
    i18n.t(locale, "page-indicator", { page: page + 1, total: totalPages }),
    cb({ t: "noop" }),
  );
  if (page < totalPages - 1) kb.text(i18n.t(locale, "nav-next"), cb(make(page + 1)));
  return kb.row();
}
