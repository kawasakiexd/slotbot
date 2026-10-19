import type { Composer } from "grammy";
import { InlineKeyboard } from "grammy";
import { env } from "../../config/env.ts";
import { formatDate, formatDateTime, formatMoney, formatTime } from "../../lib/format.ts";
import { isDomainError, errorKey } from "../../lib/errors.ts";
import { cancelByClient, canChange, listMine, releaseHold } from "../../services/bookings.ts";
import { getMaster, getService, serviceTitle } from "../../services/catalog.ts";
import { notifyCancelled } from "../../services/notifications.ts";
import { getUser, type BotContext } from "../context.ts";
import { cb, decode } from "../callbacks.ts";
import { resolveLocale, tv } from "../i18n.ts";
import { paginationRow } from "../keyboards/common.ts";
import { clientBookingCard } from "../views/bookingCard.ts";
import { showScreen, toast } from "../views/screen.ts";
import { resendInvoice } from "./payments.ts";

export function registerMyBookings(bot: Composer<BotContext>): void {
  bot.on("callback_query:data", async (ctx, next) => {
    const route = decode(ctx.callbackQuery.data);
    if (!route) return next();
    try {
      if (route.t === "my.l") return showMyList(ctx, route.p);
      if (route.t === "my.v") return showMyCard(ctx, route.id);
      if (route.t === "my.cx") return confirmCancel(ctx, route.id);
      if (route.t === "my.cxok") return doCancel(ctx, route.id);
      if (route.t === "hold.pay") return resendInvoice(ctx, route.id);
      if (route.t === "hold.rel") return doRelease(ctx, route.id);
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

export async function showMyList(ctx: BotContext, page: number): Promise<void> {
  const user = getUser(ctx);
  const locale = resolveLocale(user);
  const { rows, page: p, totalPages } = await listMine(user.id, page);
  if (rows.length === 0) {
    const kb = new InlineKeyboard().text(ctx.t("menu-book"), cb({ t: "bk.s" }));
    await showScreen(ctx, { text: ctx.t("my-empty"), keyboard: kb });
    return;
  }
  const kb = new InlineKeyboard();
  for (const row of rows) {
    const prefix = row.status === "pending_payment" ? "⏳ " : "";
    kb.text(
      `${prefix}${formatDate(row.startsAt, locale)} · ${formatTime(row.startsAt, locale)} · ${serviceTitle(row.service, locale)}`,
      cb({ t: "my.v", id: row.id }),
    ).row();
  }
  paginationRow(kb, locale, p, totalPages, (n) => ({ t: "my.l", p: n }));
  await showScreen(ctx, { text: ctx.t("my-title"), keyboard: kb });
}

async function showMyCard(ctx: BotContext, id: number): Promise<void> {
  const user = getUser(ctx);
  const locale = resolveLocale(user);
  const { rows } = await listMine(user.id, 0, 100);
  const booking = rows.find((r) => r.id === id);
  if (!booking) {
    await toast(ctx, ctx.t("error-not-found"));
    await showMyList(ctx, 0);
    return;
  }
  if (!canChange(booking) && booking.status === "confirmed") {
    await toast(ctx, ctx.t("cutoff", { hours: env.CHANGE_CUTOFF_HOURS }), false);
  }
  const card = clientBookingCard({
    locale,
    booking,
    service: booking.service,
    master: booking.master,
    payment: booking.payment,
  });
  await showScreen(ctx, card);
}

async function confirmCancel(ctx: BotContext, id: number): Promise<void> {
  const user = getUser(ctx);
  const locale = resolveLocale(user);
  const service = await (async () => {
    const { rows } = await listMine(user.id, 0, 100);
    return rows.find((r) => r.id === id);
  })();
  if (!service) {
    await toast(ctx, ctx.t("error-not-found"));
    return;
  }
  const kb = new InlineKeyboard()
    .text(ctx.t("yes-cancel"), cb({ t: "my.cxok", id }))
    .danger()
    .text(ctx.t("keep-booking"), cb({ t: "my.v", id }));
  await showScreen(ctx, {
    text: ctx.t("cancel-confirm", {
      service: serviceTitle(service.service, locale),
      date: formatDate(service.startsAt, locale),
      time: formatTime(service.startsAt, locale),
    }),
    keyboard: kb,
  });
}

async function doCancel(ctx: BotContext, id: number): Promise<void> {
  const user = getUser(ctx);
  const locale = resolveLocale(user);
  const { booking, refundPending } = await cancelByClient({ userId: user.id, bookingId: id });
  await notifyCancelled(ctx.api, booking, "client");
  const service = await getService(booking.serviceId);
  let text = ctx.t("cancelled-by-client", {
    service: service ? serviceTitle(service, locale) : "",
    date: formatDateTime(booking.startsAt, locale),
  });
  if (refundPending) {
    text += `\n${ctx.t("deposit-refund", { amount: formatMoney(booking.prepayMinor, locale) })}`;
  }
  await showScreen(ctx, {
    text,
    keyboard: new InlineKeyboard().text(ctx.t("back"), cb({ t: "my.l", p: 0 })),
  });
}

async function doRelease(ctx: BotContext, id: number): Promise<void> {
  await releaseHold(getUser(ctx).id, id);
  await showScreen(ctx, {
    text: ctx.t("hold-released"),
    keyboard: new InlineKeyboard().text(ctx.t("menu-book"), cb({ t: "bk.s" })),
  });
}

void getMaster;
