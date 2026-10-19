import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const tstz = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => tstz("created_at").notNull().defaultNow();
const updatedAt = () =>
  tstz("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const localeEnum = pgEnum("locale", ["en", "ru"]);
export const bookingStatusEnum = pgEnum("booking_status", [
  "pending_payment",
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
]);
export const cancelReasonEnum = pgEnum("cancel_reason", [
  "client",
  "admin",
  "payment_timeout",
  "replaced",
]);
export const bookingSourceEnum = pgEnum("booking_source", ["bot", "miniapp", "seed"]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "succeeded",
  "refund_pending",
  "refunded",
]);
export const broadcastStatusEnum = pgEnum("broadcast_status", ["sending", "done", "failed"]);

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  telegramId: bigint("telegram_id", { mode: "number" }).notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  username: text("username"),
  languageCode: text("language_code"),
  locale: localeEnum("locale"),
  phone: text("phone"),
  isBlocked: boolean("is_blocked").notNull().default(false),
  demoAdminUntil: tstz("demo_admin_until"),
  lastSeenAt: tstz("last_seen_at").notNull().defaultNow(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const masters = pgTable("masters", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity({ startWith: 1000 }),
  nameEn: text("name_en").notNull(),
  nameRu: text("name_ru"),
  bioEn: text("bio_en"),
  bioRu: text("bio_ru"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: smallint("sort_order").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const services = pgTable(
  "services",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity({ startWith: 1000 }),
    titleEn: text("title_en").notNull(),
    titleRu: text("title_ru"),
    descriptionEn: text("description_en"),
    descriptionRu: text("description_ru"),
    durationMin: smallint("duration_min").notNull(),
    priceMinor: integer("price_minor").notNull(),
    prepayPercent: smallint("prepay_percent").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: smallint("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("services_duration_chk", sql`${t.durationMin} between 15 and 480`),
    check("services_price_chk", sql`${t.priceMinor} >= 0`),
    check("services_prepay_chk", sql`${t.prepayPercent} in (0, 30, 50, 100)`),
  ],
);

export const masterServices = pgTable(
  "master_services",
  {
    masterId: integer("master_id")
      .notNull()
      .references(() => masters.id, { onDelete: "cascade" }),
    serviceId: integer("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.masterId, t.serviceId] }),
    index("master_services_service_idx").on(t.serviceId),
  ],
);

export const workingHours = pgTable(
  "working_hours",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    masterId: integer("master_id")
      .notNull()
      .references(() => masters.id, { onDelete: "cascade" }),
    weekday: smallint("weekday").notNull(),
    startMin: smallint("start_min").notNull(),
    endMin: smallint("end_min").notNull(),
  },
  (t) => [
    uniqueIndex("working_hours_master_weekday_uq").on(t.masterId, t.weekday),
    check("working_hours_weekday_chk", sql`${t.weekday} between 1 and 7`),
    check(
      "working_hours_range_chk",
      sql`${t.startMin} >= 0 and ${t.endMin} <= 1440 and ${t.startMin} < ${t.endMin}`,
    ),
  ],
);

export const timeOff = pgTable(
  "time_off",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    masterId: integer("master_id")
      .notNull()
      .references(() => masters.id, { onDelete: "cascade" }),
    startsAt: tstz("starts_at").notNull(),
    endsAt: tstz("ends_at").notNull(),
    reason: text("reason"),
    createdAt: createdAt(),
  },
  (t) => [
    index("time_off_master_starts_idx").on(t.masterId, t.startsAt),
    check("time_off_range_chk", sql`${t.startsAt} < ${t.endsAt}`),
  ],
);

export const bookings = pgTable(
  "bookings",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    masterId: integer("master_id")
      .notNull()
      .references(() => masters.id, { onDelete: "restrict" }),
    serviceId: integer("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    startsAt: tstz("starts_at").notNull(),
    endsAt: tstz("ends_at").notNull(),
    status: bookingStatusEnum("status").notNull(),
    source: bookingSourceEnum("source").notNull().default("bot"),
    clientName: text("client_name").notNull(),
    priceMinor: integer("price_minor").notNull(),
    prepayMinor: integer("prepay_minor").notNull().default(0),
    currency: char("currency", { length: 3 }).notNull(),
    holdExpiresAt: tstz("hold_expires_at"),
    invoiceMessageId: integer("invoice_message_id"),
    slotAssignedAt: tstz("slot_assigned_at").notNull().defaultNow(),
    rescheduleCount: smallint("reschedule_count").notNull().default(0),
    reminder24hSentAt: tstz("reminder_24h_sent_at"),
    reminder2hSentAt: tstz("reminder_2h_sent_at"),
    confirmedAt: tstz("confirmed_at"),
    cancelledAt: tstz("cancelled_at"),
    cancelReason: cancelReasonEnum("cancel_reason"),
    closedAt: tstz("closed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("bookings_range_chk", sql`${t.startsAt} < ${t.endsAt}`),
    check("bookings_prepay_chk", sql`${t.prepayMinor} between 0 and ${t.priceMinor}`),
    check(
      "bookings_hold_chk",
      sql`(${t.status} = 'pending_payment') = (${t.holdExpiresAt} is not null)`,
    ),
    index("bookings_master_starts_idx").on(t.masterId, t.startsAt),
    index("bookings_user_starts_idx").on(t.userId, t.startsAt),
    index("bookings_starts_idx").on(t.startsAt),
    index("bookings_hold_idx")
      .on(t.holdExpiresAt)
      .where(sql`${t.status} = 'pending_payment'`),
    uniqueIndex("bookings_one_hold_per_user_uq")
      .on(t.userId)
      .where(sql`${t.status} = 'pending_payment'`),
  ],
);

export const payments = pgTable("payments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  bookingId: integer("booking_id")
    .notNull()
    .unique()
    .references(() => bookings.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  amountMinor: integer("amount_minor").notNull(),
  currency: char("currency", { length: 3 }).notNull(),
  status: paymentStatusEnum("status").notNull().default("succeeded"),
  telegramChargeId: text("telegram_charge_id").notNull().unique(),
  providerChargeId: text("provider_charge_id").notNull(),
  refundedAt: tstz("refunded_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const aiUsage = pgTable(
  "ai_usage",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    day: date("day", { mode: "string" }).notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    cachedInputTokens: integer("cached_input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costMicroUsd: integer("cost_micro_usd").notNull().default(0),
    ok: boolean("ok").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("ai_usage_day_user_idx").on(t.day, t.userId)],
);

export const broadcasts = pgTable("broadcasts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  createdBy: integer("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  isSandbox: boolean("is_sandbox").notNull(),
  status: broadcastStatusEnum("status").notNull().default("sending"),
  recipientsTotal: integer("recipients_total").notNull(),
  sentCount: integer("sent_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  createdAt: createdAt(),
  finishedAt: tstz("finished_at"),
});

export const botKv = pgTable("bot_kv", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: updatedAt(),
});

export const usersRelations = relations(users, ({ many }) => ({ bookings: many(bookings) }));
export const mastersRelations = relations(masters, ({ many }) => ({
  masterServices: many(masterServices),
  workingHours: many(workingHours),
  bookings: many(bookings),
}));
export const servicesRelations = relations(services, ({ many }) => ({
  masterServices: many(masterServices),
  bookings: many(bookings),
}));
export const masterServicesRelations = relations(masterServices, ({ one }) => ({
  master: one(masters, { fields: [masterServices.masterId], references: [masters.id] }),
  service: one(services, { fields: [masterServices.serviceId], references: [services.id] }),
}));
export const workingHoursRelations = relations(workingHours, ({ one }) => ({
  master: one(masters, { fields: [workingHours.masterId], references: [masters.id] }),
}));
export const bookingsRelations = relations(bookings, ({ one }) => ({
  user: one(users, { fields: [bookings.userId], references: [users.id] }),
  master: one(masters, { fields: [bookings.masterId], references: [masters.id] }),
  service: one(services, { fields: [bookings.serviceId], references: [services.id] }),
  payment: one(payments, { fields: [bookings.id], references: [payments.bookingId] }),
}));
export const paymentsRelations = relations(payments, ({ one }) => ({
  booking: one(bookings, { fields: [payments.bookingId], references: [bookings.id] }),
}));

export type UserRow = typeof users.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Master = typeof masters.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type WorkingHour = typeof workingHours.$inferSelect;
export type TimeOff = typeof timeOff.$inferSelect;
