export type AiIntent = "faq" | "booking" | "off_topic";

export interface AiAnswer {
  answer: string;
  intent: AiIntent;
  serviceId: number | null;
}

export interface AiUsageTokens {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}

export interface AiProvider {
  complete(input: {
    instructions: string;
    question: string;
    safetyId: string;
  }): Promise<{ answer: AiAnswer; tokens: AiUsageTokens }>;
}
