import "server-only";

import type { AnswerMode } from "@/lib/ai/answer-modes";

export const AI_RESPONSE_TIMEOUT_MS = 10 * 60 * 1000;
export const TITLE_GENERATION_TIMEOUT_MS = 60 * 1000;
export const TITLE_MAX_TOKENS = 128;

export type ResponseBudget = { targetTokens: number; maxTokens: number };

export const RESPONSE_BUDGETS = {
  standard: { targetTokens: 600, maxTokens: 1024 },
  concise: { targetTokens: 250, maxTokens: 512 },
  detailed: { targetTokens: 1250, maxTokens: 2048 },
  creative: { targetTokens: 900, maxTokens: 1536 },
  code: { targetTokens: 1250, maxTokens: 2048 },
  tutorial: { targetTokens: 800, maxTokens: 1536 },
} satisfies Record<AnswerMode, ResponseBudget>;
