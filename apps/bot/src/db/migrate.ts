import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzleDir } from "../lib/paths.ts";
import { logger } from "../logger.ts";
import { db } from "./client.ts";

export async function runMigrations(): Promise<void> {
  await migrate(db, { migrationsFolder: drizzleDir() });
  logger.info({ module: "db" }, "migrations applied");
}
