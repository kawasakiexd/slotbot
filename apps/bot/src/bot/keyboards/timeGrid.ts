import { InlineKeyboard } from "grammy";
import { formatTime } from "../../lib/format.ts";
import { epochMinutes } from "../../lib/time.ts";
import { cb, type Route } from "../callbacks.ts";
import { i18n } from "../i18n.ts";

export function timeGridKeyboard(input: {
  locale: string;
  slots: Date[];
  onTime: (em: number) => Route;
  back: Route;
  cancel: Route;
}): InlineKeyboard {
  const kb = new InlineKeyboard();
  let col = 0;
  for (const slot of input.slots) {
    kb.text(formatTime(slot, input.locale), cb(input.onTime(epochMinutes(slot))));
    col += 1;
    if (col === 4) {
      kb.row();
      col = 0;
    }
  }
  if (col !== 0) kb.row();
  kb.text(i18n.t(input.locale, "back"), cb(input.back)).text(
    i18n.t(input.locale, "cancel"),
    cb(input.cancel),
  );
  return kb;
}
