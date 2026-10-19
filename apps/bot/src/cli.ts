import { closeDb } from "./db/client.ts";
import { runMigrations } from "./db/migrate.ts";
import { logger } from "./logger.ts";
import { resetDemo } from "./services/demo.ts";

const command = process.argv[2];

async function main(): Promise<void> {
  if (command === "migrate") {
    await runMigrations();
    return;
  }
  if (command === "seed") {
    await resetDemo();
    return;
  }
  console.error("Usage: cli migrate|seed");
  process.exitCode = 1;
}

main()
  .catch((err: unknown) => {
    logger.error({ err }, "cli failed");
    process.exitCode = 1;
  })
  .finally(() => closeDb());
