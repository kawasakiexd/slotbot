import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { env } from "../config/env.ts";
import { sql } from "../db/client.ts";
import { logger } from "../logger.ts";

const log = logger.child({ module: "http" });

export function createHttpApp(): Hono {
  const app = new Hono();
  app.get("/healthz", async (c) => {
    await sql`SELECT 1`;
    return c.json({ ok: true });
  });
  return app;
}

export function startHttp(): { close: () => Promise<void> } {
  const app = createHttpApp();
  const server = serve({ fetch: app.fetch, port: env.HTTP_PORT, hostname: "0.0.0.0" });
  log.info({ port: env.HTTP_PORT }, "http listening");
  return {
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      }),
  };
}
