import { resolve } from "node:path";
import { env } from "../config/env.ts";

export function appRoot(): string {
  return env.appRoot;
}

export function localesDir(): string {
  return resolve(appRoot(), "locales");
}

export function drizzleDir(): string {
  return resolve(appRoot(), "drizzle");
}

export function contentDir(): string {
  return resolve(appRoot(), "content");
}

export function knowledgePath(): string {
  return resolve(contentDir(), "knowledge.md");
}

export function miniappDistDir(): string {
  return resolve(appRoot(), "../../apps/miniapp/dist");
}
