import { IANAZone } from "luxon";
import { z } from "zod";

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    LOG_LEVEL: z.string().default("info"),
    APP_ROOT: z.string().optional().default(""),
    BOT_TOKEN: z.string().min(1),
    DATABASE_URL: z.string().min(1),
    ADMIN_IDS: z.string().default("494979019"),
    NOTIFY_ADMINS: z.stringbool().default(true),
    DEMO_MODE: z.stringbool().default(false),
    DEMO_ADMIN_MINUTES: z.coerce.number().int().positive().default(30),
    DEMO_RESET_CRON: z.string().default("0 0 4 * * *"),
    DEMO_RESTORE_COOLDOWN_MINUTES: z.coerce.number().int().positive().default(10),
    SALON_TIMEZONE: z.string().default("America/New_York"),
    CURRENCY: z.string().length(3).default("USD"),
    PAYMENTS_ENABLED: z.stringbool().default(false),
    PAYMENT_PROVIDER_TOKEN: z.string().optional().default(""),
    HOLD_MINUTES: z.coerce.number().int().positive().default(15),
    CHANGE_CUTOFF_HOURS: z.coerce.number().positive().default(2),
    MIN_LEAD_MINUTES: z.coerce.number().int().nonnegative().default(60),
    BOOKING_HORIZON_DAYS: z.coerce.number().int().positive().default(30),
    SLOT_STEP_MINUTES: z.coerce.number().int().positive().default(15),
    MAX_ACTIVE_BOOKINGS_PER_USER: z.coerce.number().int().positive().default(3),
    MAX_RESCHEDULES: z.coerce.number().int().nonnegative().default(2),
    OPENAI_API_KEY: z.string().optional().default(""),
    AI_MODEL: z.string().default("gpt-6-luna"),
    AI_REASONING_EFFORT: z.enum(["none", "minimal", "low", "medium"]).default("none"),
    AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(400),
    AI_PRICE_INPUT_PER_1M_USD: z.coerce.number().nonnegative().default(0.1),
    AI_PRICE_CACHED_INPUT_PER_1M_USD: z.coerce.number().nonnegative().default(0.01),
    AI_PRICE_OUTPUT_PER_1M_USD: z.coerce.number().nonnegative().default(0.5),
    AI_USER_DAILY_LIMIT: z.coerce.number().int().positive().default(10),
    AI_GLOBAL_DAILY_REQUESTS: z.coerce.number().int().positive().default(500),
    AI_GLOBAL_DAILY_BUDGET_USD: z.coerce.number().nonnegative().default(1),
    HTTP_PORT: z.coerce.number().int().positive().default(3000),
    PUBLIC_URL: z.string().optional().default(""),
    MINIAPP_ENABLED: z.stringbool().default(false),
    INITDATA_MAX_AGE_SECONDS: z.coerce.number().int().positive().default(86400),
  })
  .superRefine((data, ctx) => {
    if (!IANAZone.isValidZone(data.SALON_TIMEZONE)) {
      ctx.addIssue({
        code: "custom",
        path: ["SALON_TIMEZONE"],
        message: `Invalid IANA time zone: ${data.SALON_TIMEZONE}`,
      });
    }
    if (data.PAYMENTS_ENABLED) {
      if (!data.PAYMENT_PROVIDER_TOKEN) {
        ctx.addIssue({
          code: "custom",
          path: ["PAYMENT_PROVIDER_TOKEN"],
          message: "PAYMENT_PROVIDER_TOKEN is required when PAYMENTS_ENABLED=true",
        });
      } else if (!data.PAYMENT_PROVIDER_TOKEN.includes(":TEST:")) {
        ctx.addIssue({
          code: "custom",
          path: ["PAYMENT_PROVIDER_TOKEN"],
          message: "Live payment tokens are refused. Use a Stripe TEST token containing :TEST:.",
        });
      }
    } else if (data.PAYMENT_PROVIDER_TOKEN && !data.PAYMENT_PROVIDER_TOKEN.includes(":TEST:")) {
      ctx.addIssue({
        code: "custom",
        path: ["PAYMENT_PROVIDER_TOKEN"],
        message: "Live payment tokens are refused. Use a Stripe TEST token containing :TEST:.",
      });
    }
  });

function parseEnv(): z.infer<typeof envSchema> {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const lines = result.error.issues.map((issue) => `  ${issue.path.join(".")}: ${issue.message}`);
    console.error(`Invalid environment:\n${lines.join("\n")}`);
    process.exit(1);
  }
  return result.data;
}

const parsed = parseEnv();

export const env = {
  ...parsed,
  appRoot: parsed.APP_ROOT || process.cwd(),
  adminIds: parsed.ADMIN_IDS.split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0),
};

export function isPlaceholderBotToken(): boolean {
  return env.BOT_TOKEN.includes("YourBotFatherTokenHere") || env.BOT_TOKEN.includes("Placeholder");
}
