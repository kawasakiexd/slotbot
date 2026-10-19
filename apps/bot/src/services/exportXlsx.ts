import ExcelJS from "exceljs";
import { and, gte, lt } from "drizzle-orm";
import { db } from "../db/client.ts";
import { bookings } from "../db/schema.ts";
import { formatDate, formatMoney, formatTime } from "../lib/format.ts";
import { displayClient } from "./privacy.ts";
import type { Viewer } from "./roles.ts";
import { getStats, type StatsPeriod } from "./stats.ts";
import { displayName } from "../bot/i18n.ts";

export async function buildBookingsXlsx(
  period: StatsPeriod,
  locale: string,
  actor: Viewer,
): Promise<{ buffer: Buffer; filename: string }> {
  const stats = await getStats(period);
  const rows = await db.query.bookings.findMany({
    where: and(gte(bookings.startsAt, stats.start), lt(bookings.startsAt, stats.end)),
    orderBy: (t, { asc }) => [asc(t.startsAt)],
    with: { service: true, master: true, user: true, payment: true },
  });

  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Bookings");
  sheet.columns = [
    { header: "ID", key: "id", width: 8 },
    { header: "Date", key: "date", width: 14 },
    { header: "Time", key: "time", width: 10 },
    { header: "Master", key: "master", width: 18 },
    { header: "Service", key: "service", width: 22 },
    { header: "Client", key: "client", width: 18 },
    { header: "Phone", key: "phone", width: 16 },
    { header: "Status", key: "status", width: 16 },
    { header: "Price", key: "price", width: 12 },
    { header: "Deposit", key: "deposit", width: 12 },
    { header: "Payment", key: "payment", width: 16 },
    { header: "Source", key: "source", width: 10 },
    { header: "Created at", key: "created", width: 22 },
  ];
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: "A1", to: "M1" };
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    const shown = displayClient(actor, row.user, row.clientName, actor.userId, row.userId);
    sheet.addRow({
      id: row.id,
      date: formatDate(row.startsAt, locale),
      time: formatTime(row.startsAt, locale),
      master: displayName(locale, row.master.nameEn, row.master.nameRu),
      service: displayName(locale, row.service.titleEn, row.service.titleRu),
      client: shown.name,
      phone: shown.phone ?? "",
      status: row.status,
      price: formatMoney(row.priceMinor, locale, row.currency),
      deposit: formatMoney(row.prepayMinor, locale, row.currency),
      payment: row.payment?.status ?? "",
      source: row.source,
      created: row.createdAt.toISOString(),
    });
  }

  const summary = wb.addWorksheet("Summary");
  summary.addRows([
    ["From", stats.from],
    ["To", stats.to],
    ["Bookings", stats.total],
    ["Completed", stats.completed],
    ["No-show", stats.noshow],
    ["Cancelled", stats.cancelled],
    ["Upcoming", stats.upcoming],
    ["Revenue", formatMoney(stats.revenueMinor, locale)],
    ["Deposits", formatMoney(stats.depositsMinor, locale)],
    ["Refunds pending", formatMoney(stats.refundsPendingMinor, locale)],
    ["No-show rate %", stats.noshowRate],
    ["New clients", stats.newClients],
  ]);

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  const fromIso = stats.start.toISOString().slice(0, 10);
  const toIso = new Date(stats.end.getTime() - 1).toISOString().slice(0, 10);
  return { buffer, filename: `slotbot-bookings-${fromIso}_${toIso}.xlsx` };
}
