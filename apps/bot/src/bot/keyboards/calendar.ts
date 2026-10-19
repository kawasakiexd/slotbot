import { InlineKeyboard } from "grammy";
import { env } from "../../config/env.ts";
import {
  addLocalMonths,
  daysInLocalMonth,
  isoWeekday,
  localDay,
  localMonth,
  nowUtc,
} from "../../lib/time.ts";
import { formatMonthTitle, formatWeekdayShort } from "../../lib/format.ts";
import { cb, type Route } from "../callbacks.ts";
import { i18n } from "../i18n.ts";

export function calendarKeyboard(input: {
  locale: string;
  month: string;
  freeDays: Set<string>;
  onDay: (date: string) => Route;
  onMonth: (month: string) => Route;
  back: Route;
  cancel: Route;
  minDate?: string;
  maxDate?: string;
  disableUnavailable?: boolean;
}): InlineKeyboard {
  const kb = new InlineKeyboard();
  const today = localDay(nowUtc());
  const min = input.minDate ?? today;
  const max = input.maxDate ?? `${addLocalMonths(localMonth(nowUtc()), 0)}-placeholder`;
  void max;
  const horizonDate = (() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + env.BOOKING_HORIZON_DAYS);
    return localDay(d);
  })();

  kb.text(formatMonthTitle(input.month, input.locale), cb({ t: "noop" })).row();
  for (let wd = 1; wd <= 7; wd++) {
    kb.text(formatWeekdayShort(wd, input.locale), cb({ t: "noop" }));
  }
  kb.row();

  const firstWd = isoWeekday(`${input.month}-01`);
  const blanks = firstWd - 1;
  const days = daysInLocalMonth(input.month);
  let col = 0;
  for (let i = 0; i < blanks; i++) {
    kb.text(" ", cb({ t: "noop" }));
    col += 1;
  }
  for (let d = 1; d <= days; d++) {
    const date = `${input.month}-${String(d).padStart(2, "0")}`;
    const label = String(d);
    const outOfRange = date < min || date > (input.maxDate ?? horizonDate);
    const free = input.freeDays.has(date);
    if (outOfRange || (input.disableUnavailable !== false && !free)) {
      kb.disabled(label);
    } else {
      kb.text(label, cb(input.onDay(date)));
    }
    col += 1;
    if (col === 7) {
      kb.row();
      col = 0;
    }
  }
  if (col !== 0) kb.row();

  const prev = addLocalMonths(input.month, -1);
  const next = addLocalMonths(input.month, 1);
  const minMonth = min.slice(0, 7);
  const maxMonth = (input.maxDate ?? horizonDate).slice(0, 7);
  if (prev >= minMonth) kb.text(i18n.t(input.locale, "nav-prev"), cb(input.onMonth(prev)));
  else kb.disabled(i18n.t(input.locale, "nav-prev"));
  if (next <= maxMonth) kb.text(i18n.t(input.locale, "nav-next"), cb(input.onMonth(next)));
  else kb.disabled(i18n.t(input.locale, "nav-next"));
  kb.row();
  kb.text(i18n.t(input.locale, "back"), cb(input.back)).text(
    i18n.t(input.locale, "cancel"),
    cb(input.cancel),
  );
  return kb;
}
