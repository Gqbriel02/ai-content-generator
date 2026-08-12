import "server-only";

import type { AnswerMode } from "@/lib/ai/answer-modes";

export const AI_RESPONSE_TIMEOUT_MS = 10 * 60 * 1000;
export const TITLE_GENERATION_TIMEOUT_MS = 60 * 1000;
export const TITLE_MAX_TOKENS = 128;

export const MAX_TOKENS_BY_MODE: Record<AnswerMode, number> = {
  standard: 1024,
  concise: 512,
  detailed: 2048,
  creative: 1536,
  code: 2048,
  tutorial: 1536,
};
