import { createHash } from "node:crypto";
import { env } from "../../config/env.ts";
import { DomainError } from "../../lib/errors.ts";
import { buildKnowledge } from "./knowledge.ts";
import { createOpenAiProvider } from "./openai.ts";
import type { AiAnswer } from "./provider.ts";
import { assertAiAllowed, recordUsage } from "./usage.ts";

const provider = env.OPENAI_API_KEY ? createOpenAiProvider() : null;

export async function askAssistant(input: {
  userId: number;
  telegramId: number;
  question: string;
}): Promise<AiAnswer> {
  if (!provider || !env.OPENAI_API_KEY) throw new DomainError("AI_DISABLED");
  await assertAiAllowed(input.userId);
  const truncated = input.question.length > 500;
  const question = input.question.slice(0, 500);
  const instructions = await buildKnowledge();
  const safetyId = createHash("sha256").update(String(input.telegramId)).digest("hex");
  try {
    const { answer, tokens } = await provider.complete({
      instructions,
      question,
      safetyId,
    });
    await recordUsage({ userId: input.userId, tokens, ok: true });
    if (truncated) {
      return { ...answer, answer: `${answer.answer}` };
    }
    return answer;
  } catch (err) {
    if (err instanceof DomainError) throw err;
    await recordUsage({
      userId: input.userId,
      tokens: { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 },
      ok: false,
    });
    throw err;
  }
}
