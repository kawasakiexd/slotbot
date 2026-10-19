import { run, type RunnerHandle } from "@grammyjs/runner";
import { env, isPlaceholderBotToken } from "./config/env.ts";
import { closeDb } from "./db/client.ts";
import { runMigrations } from "./db/migrate.ts";
import { logger } from "./logger.ts";
import { createBot } from "./bot/index.ts";
import { setCommands } from "./bot/commands.ts";
import { startHttp } from "./http/server.ts";
import { startJobs, stopJobs } from "./jobs/scheduler.ts";
import { catalogIsEmpty, resetDemo } from "./services/demo.ts";

const log = logger.child({ module: "boot" });

async function main(): Promise<void> {
  await runMigrations();
  if (env.DEMO_MODE && (await catalogIsEmpty())) {
    await resetDemo();
  }

  const bot = createBot();
  let runner: RunnerHandle | undefined;
  if (isPlaceholderBotToken()) {
    log.warn("BOT_TOKEN is a placeholder — skipping Telegram polling");
  } else {
    await bot.init();
    await setCommands(bot.api);
    log.info({ username: bot.botInfo.username }, "bot ready");
  }

  const http = startHttp();
  if (!isPlaceholderBotToken()) {
    startJobs(bot.api);
    runner = run(bot, {
      runner: {
        fetch: {
          allowed_updates: ["message", "callback_query", "pre_checkout_query", "my_chat_member"],
        },
      },
    });
  }

  const shutdown = async (signal: string) => {
    log.info({ signal }, "shutting down");
    stopJobs();
    try {
      await runner?.stop();
    } catch (err) {
      log.warn({ err }, "runner stop");
    }
    try {
      await http.close();
    } catch (err) {
      log.warn({ err }, "http close");
    }
    await closeDb();
    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err: unknown) => {
  log.error({ err }, "fatal");
  void closeDb().finally(() => process.exit(1));
});
