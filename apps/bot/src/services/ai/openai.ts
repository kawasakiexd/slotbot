import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { env } from "../../config/env.ts";
import type { AiAnswer, AiProvider, AiUsageTokens } from "./provider.ts";

const AnswerSchema = z.object({
  answer: z.string(),
  intent: z.enum(["faq", "booking", "off_topic"]),
  serviceId: z.number().nullable(),
});

export function createOpenAiProvider(): AiProvider {
  const client = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    timeout: 15_000,
    maxRetries: 1,
  });

  return {
    async complete({ instructions, question, safetyId }) {
      const response = await client.responses.parse({
        model: env.AI_MODEL,
        instructions,
        input: question,
        max_output_tokens: env.AI_MAX_OUTPUT_TOKENS,
        reasoning: { effort: env.AI_REASONING_EFFORT },
        text: { format: zodTextFormat(AnswerSchema, "salon_answer") },
        prompt_cache_key: "slotbot-salon-faq",
        safety_identifier: safetyId,
        store: false,
      });
      const parsed = response.output_parsed;
      if (!parsed) throw new Error("empty AI parse");
      const usage = response.usage;
      const tokens: AiUsageTokens = {
        inputTokens: usage?.input_tokens ?? 0,
        cachedInputTokens: usage?.input_tokens_details?.cached_tokens ?? 0,
        outputTokens: usage?.output_tokens ?? 0,
      };
      const answer: AiAnswer = {
        answer: parsed.answer,
        intent: parsed.intent,
        serviceId: parsed.serviceId,
      };
      return { answer, tokens };
    },
  };
}
