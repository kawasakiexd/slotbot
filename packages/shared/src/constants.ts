export const LOCALES = ["en", "ru"] as const;
export type Locale = (typeof LOCALES)[number];

export const BOOKING_STATUSES = [
  "pending_payment",
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const DEPOSIT_PERCENTS = [0, 30, 50, 100] as const;
export type DepositPercent = (typeof DEPOSIT_PERCENTS)[number];

export const DEMO_SEED_ID_LIMIT = 1000;
