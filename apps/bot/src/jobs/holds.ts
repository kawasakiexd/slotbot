import { and, eq, lte } from "drizzle-orm";
import type { Api } from "grammy";
import { db } from "../db/client.ts";
import { bookings } from "../db/schema.ts";
import { formatDate } from "../lib/format.ts";
import { logger } from "../logger.ts";
import { i18n, resolveLocale } from "../bot/i18n.ts";
import { getService, serviceTitle } from "../services/catalog.ts";
import { notifyUser } from "../services/notifications.ts";
import { getUserById } from "../services/users.ts";

const log = logger.child({ module: "holds" });

export async function expireHolds(api: Api): Promise<void> {
  const expired = await db
    .update(bookings)
    .set({
      status: "cancelled",
      cancelReason: "payment_timeout",
      cancelledAt: new Date(),
      holdExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(bookings.status, "pending_payment"), lte(bookings.holdExpiresAt, new Date())))
    .returning();

  if (expired.length === 0) return;

  for (const booking of expired) {
    const user = await getUserById(booking.userId);
    if (user && booking.invoiceMessageId && user.telegramId > 0) {
      try {
        await api.deleteMessage(user.telegramId, booking.invoiceMessageId);
      } catch (err) {
        log.warn({ err, bookingId: booking.id }, "invoice delete failed");
      }
    }
    const service = await getService(booking.serviceId);
    if (!user || !service) continue;
    const locale = resolveLocale(user);
    await notifyUser(
      api,
      user,
      i18n.t(locale, "hold-expired", {
        service: serviceTitle(service, locale),
        date: formatDate(booking.startsAt, locale),
      }),
    );
  }

  log.info({ expired: expired.length }, "holds expired");
}
