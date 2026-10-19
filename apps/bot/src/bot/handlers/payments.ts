import type { Composer } from "grammy";
import { InlineKeyboard } from "grammy";
import type { Booking } from "../../db/schema.ts";
import { env } from "../../config/env.ts";
import { getBooking } from "../../services/bookings.ts";
import { approvePreCheckout, confirmPayment, invoiceCopy } from "../../services/payments.ts";
import { notifyNewBooking } from "../../services/notifications.ts";
import { setInvoiceMessageId } from "../../services/bookings.ts";
import { getUser, type BotContext } from "../context.ts";
import { resolveLocale } from "../i18n.ts";
import { clientBookingCard } from "../views/bookingCard.ts";
import { showScreen, toast } from "../views/screen.ts";
import { getMaster, getService } from "../../services/catalog.ts";

export function registerPayments(bot: Composer<BotContext>): void {
  bot.on("pre_checkout_query", async (ctx) => {
    const result = await approvePreCheckout(ctx.preCheckoutQuery);
    if (result.ok) await ctx.answerPreCheckoutQuery(true);
    else await ctx.answerPreCheckoutQuery(false, { error_message: result.error });
  });

  bot.on("message:successful_payment", async (ctx) => {
    const payment = ctx.message.successful_payment;
    if (!payment) return;
    const { booking, lateLost } = await confirmPayment(payment);
    const user = getUser(ctx);
    const locale = resolveLocale(user);
    if (lateLost) {
      await ctx.reply(ctx.t("error-generic"));
      return;
    }
    await notifyNewBooking(ctx.api, booking);
    const service = await getService(booking.serviceId);
    const master = await getMaster(booking.masterId);
    if (!service || !master) {
      await ctx.reply(ctx.t("paid"));
      return;
    }
    const card = clientBookingCard({ locale, booking, service, master });
    await ctx.reply(`${ctx.t("paid")}\n\n${card.text}`, {
      parse_mode: "HTML",
      reply_markup: card.keyboard,
    });
  });
}

export async function sendInvoiceFor(ctx: BotContext, booking: Booking): Promise<void> {
  if (!env.PAYMENTS_ENABLED || !env.PAYMENT_PROVIDER_TOKEN) return;
  const locale = resolveLocale(getUser(ctx));
  const params = await invoiceCopy(booking, locale);
  const msg = await ctx.replyWithInvoice(
    params.title,
    params.description,
    params.payload,
    params.currency,
    params.prices,
    {
      provider_token: params.provider_token,
      start_parameter: params.start_parameter,
      protect_content: true,
    },
  );
  await setInvoiceMessageId(booking.id, msg.message_id);
}

export async function resendInvoice(ctx: BotContext, bookingId: number): Promise<void> {
  const booking = await getBooking(bookingId);
  if (booking.userId !== getUser(ctx).id || booking.status !== "pending_payment") {
    await toast(ctx, ctx.t("hold-pay-gone"));
    return;
  }
  await sendInvoiceFor(ctx, booking);
  if (ctx.callbackQuery) await ctx.answerCallbackQuery();
}

void InlineKeyboard;
void showScreen;
