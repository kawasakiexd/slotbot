import type { Api } from "grammy";
import { Cron } from "croner";
import { env } from "../config/env.ts";
import { logger } from "../logger.ts";
import { resetDemoJob } from "./demoReset.ts";
import { expireHolds } from "./holds.ts";
import { sendDueReminders } from "./reminders.ts";

const log = logger.child({ module: "jobs" });
const jobs: Cron[] = [];

export function startJobs(api: Api): void {
  jobs.push(
    new Cron("*/30 * * * * *", { protect: true, name: "tick" }, () => {
      void tick(api);
    }),
  );
  if (env.DEMO_MODE) {
    jobs.push(
      new Cron(
        env.DEMO_RESET_CRON,
        {
          protect: true,
          timezone: env.SALON_TIMEZONE,
          name: "demo-reset",
        },
        () => {
          void resetDemoJob();
        },
      ),
    );
  }
  log.info({ count: jobs.length }, "jobs started");
}

export function stopJobs(): void {
  for (const job of jobs) job.stop();
  jobs.length = 0;
}

async function tick(api: Api): Promise<void> {
  try {
    await expireHolds(api);
    await sendDueReminders(api);
  } catch (err) {
    log.error({ err }, "tick failed");
  }
}
