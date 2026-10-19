import { and, eq, sql } from "drizzle-orm";
import { env } from "../../config/env.ts";
import { db } from "../../db/client.ts";
import { aiUsage } from "../../db/schema.ts";
import { DomainError } from "../../lib/errors.ts";
import { localDay, nowUtc } from "../../lib/time.ts";
import type { AiUsageTokens } from "./provider.ts";

export function costMicroUsd(tokens: AiUsageTokens): number {
  const uncached = Math.max(0, tokens.inputTokens - tokens.cachedInputTokens);
  const usd =
    (uncached / 1_000_000) * env.AI_PRICE_INPUT_PER_1M_USD +
    (tokens.cachedInputTokens / 1_000_000) * env.AI_PRICE_CACHED_INPUT_PER_1M_USD +
    (tokens.outputTokens / 1_000_000) * env.AI_PRICE_OUTPUT_PER_1M_USD;
  return Math.round(usd * 1_000_000);
}

export async function assertAiAllowed(userId: number): Promise<{ left: number }> {
  if (!env.OPENAI_API_KEY) throw new DomainError("AI_DISABLED");
  const day = localDay(nowUtc());
  const [userRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(aiUsage)
    .where(and(eq(aiUsage.day, day), eq(aiUsage.userId, userId), eq(aiUsage.ok, true)));
  const used = Number(userRow?.n ?? 0);
  if (used >= env.AI_USER_DAILY_LIMIT) {
    throw new DomainError("AI_LIMIT_USER", {
      limit: env.AI_USER_DAILY_LIMIT,
      tz: env.SALON_TIMEZONE,
    });
  }
  const [globalRow] = await db
    .select({
      n: sql<number>`count(*)::int`,
      cost: sql<number>`coalesce(sum(${aiUsage.costMicroUsd}),0)::int`,
    })
    .from(aiUsage)
    .where(and(eq(aiUsage.day, day), eq(aiUsage.ok, true)));
  const requests = Number(globalRow?.n ?? 0);
  const cost = Number(globalRow?.cost ?? 0);
  if (
    requests >= env.AI_GLOBAL_DAILY_REQUESTS ||
    cost / 1_000_000 >= env.AI_GLOBAL_DAILY_BUDGET_USD
  ) {
    throw new DomainError("AI_LIMIT_GLOBAL");
  }
  return { left: env.AI_USER_DAILY_LIMIT - used };
}

export async function recordUsage(input: {
  userId: number;
  tokens: AiUsageTokens;
  ok: boolean;
}): Promise<void> {
  await db.insert(aiUsage).values({
    userId: input.userId,
    day: localDay(nowUtc()),
    model: env.AI_MODEL,
    inputTokens: input.tokens.inputTokens,
    cachedInputTokens: input.tokens.cachedInputTokens,
    outputTokens: input.tokens.outputTokens,
    costMicroUsd: costMicroUsd(input.tokens),
    ok: input.ok,
  });
}

export async function questionsLeft(userId: number): Promise<number> {
  try {
    const { left } = await assertAiAllowed(userId);
    return left;
  } catch {
    return 0;
  }
}
