import type { Composer } from "grammy";
import { InlineKeyboard } from "grammy";
import { isDomainError, errorKey } from "../../lib/errors.ts";
import { formatDateTime } from "../../lib/format.ts";
import { cancelByAdmin, closeBooking, getBooking, listUpcoming } from "../../services/bookings.ts";
import { markRefunded } from "../../services/payments.ts";
import { notifyCancelled } from "../../services/notifications.ts";
import { asViewer } from "../../services/roles.ts";
import { getUser, type BotContext } from "../context.ts";
import { cb, decode } from "../callbacks.ts";
import { resolveLocale, tv } from "../i18n.ts";
import { paginationRow } from "../keyboards/common.ts";
import { adminBookingCard } from "../views/bookingCard.ts";
import { showScreen, toast } from "../views/screen.ts";

export function registerAdminBookings(bot: Composer<BotContext>): void {
  bot.on("callback_query:data", async (ctx, next) => {
    const route = decode(ctx.callbackQuery.data);
    if (!route) return next();
    const viewer = asViewer(getUser(ctx));
    if (!viewer) return next();
    try {
      if (route.t === "ad.up") return showUpcoming(ctx, route.p);
      if (route.t === "ad.bk") return showCard(ctx, route.id);
      if (route.t === "ad.done") {
        await closeBooking({ actor: viewer, bookingId: route.id, status: "completed" });
        await toast(ctx, ctx.t("marked-completed"), false);
        return showCard(ctx, route.id);
      }
      if (route.t === "ad.ns") {
        await closeBooking({ actor: viewer, bookingId: route.id, status: "no_show" });
        await toast(ctx, ctx.t("marked-noshow"), false);
        return showCard(ctx, route.id);
      }
      if (route.t === "ad.cx") return confirmAdminCancel(ctx, route.id);
      if (route.t === "ad.cxok") {
        const { booking } = await cancelByAdmin({ actor: viewer, bookingId: route.id });
        await notifyCancelled(ctx.api, booking, "admin");
        await toast(
          ctx,
          ctx.t("cancelled-by-salon", {
            service: booking.serviceId,
            date: formatDateTime(booking.startsAt, resolveLocale(getUser(ctx))),
          }),
          false,
        );
        return showCard(ctx, route.id);
      }
      if (route.t === "ad.rf") {
        await markRefunded(route.id);
        await toast(ctx, ctx.t("marked-refunded"), false);
        return showCard(ctx, route.id);
      }
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

async function showUpcoming(ctx: BotContext, page: number): Promise<void> {
  const locale = resolveLocale(getUser(ctx));
  const { rows, page: p, totalPages } = await listUpcoming(page);
  const kb = new InlineKeyboard();
  for (const row of rows) {
    kb.text(
      `${formatDateTime(row.startsAt, locale)} · ${row.service.titleEn}`,
      cb({ t: "ad.bk", id: row.id }),
    ).row();
  }
  paginationRow(kb, locale, p, totalPages, (n) => ({ t: "ad.up", p: n }));
  kb.text(ctx.t("admin-back"), cb({ t: "ad.h" }));
  await showScreen(ctx, { text: ctx.t("upcoming-title"), keyboard: kb });
}

async function showCard(ctx: BotContext, id: number): Promise<void> {
  const viewer = asViewer(getUser(ctx));
  if (!viewer) return;
  const booking = await getBooking(id);
  const screen = adminBookingCard({
    locale: resolveLocale(getUser(ctx)),
    booking,
    actor: viewer,
  });
  await showScreen(ctx, screen);
}

async function confirmAdminCancel(ctx: BotContext, id: number): Promise<void> {
  const kb = new InlineKeyboard()
    .text(ctx.t("yes-cancel"), cb({ t: "ad.cxok", id }))
    .danger()
    .text(ctx.t("keep-booking"), cb({ t: "ad.bk", id }));
  await showScreen(ctx, { text: ctx.t("cancel-booking"), keyboard: kb });
}
