import { pino } from "pino";
import { env } from "./config/env.ts";

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "slotbot" },
  redact: {
    paths: ["*.token", "*.providerToken", "*.phone", "*.initData", "*.authorization"],
    censor: "[redacted]",
  },
  ...(env.NODE_ENV === "development"
    ? { transport: { target: "pino-pretty", options: { colorize: true } } }
    : {}),
});
