import { describe, expect, it } from "vitest";
import { vi } from "vitest";
vi.mock("server-only", () => ({}));
import { AI_RESPONSE_TIMEOUT_MS, RESPONSE_BUDGETS, TITLE_GENERATION_TIMEOUT_MS, TITLE_MAX_TOKENS } from "./config";

describe("server AI generation configuration", () => {
  it("uses the intended per-mode ceilings", () => {
    expect(RESPONSE_BUDGETS).toEqual({
      standard: { targetTokens: 600, maxTokens: 1024 },
      concise: { targetTokens: 250, maxTokens: 512 },
      detailed: { targetTokens: 1250, maxTokens: 2048 },
      creative: { targetTokens: 900, maxTokens: 1536 },
      code: { targetTokens: 1250, maxTokens: 2048 },
      tutorial: { targetTokens: 800, maxTokens: 1536 },
    });
  });
  it("uses separate response and title budgets", () => {
    expect(AI_RESPONSE_TIMEOUT_MS).toBe(600_000);
    expect(TITLE_GENERATION_TIMEOUT_MS).toBe(60_000);
    expect(TITLE_MAX_TOKENS).toBe(128);
  });
});
