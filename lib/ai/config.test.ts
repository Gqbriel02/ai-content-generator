import { describe, expect, it } from "vitest";
import { vi } from "vitest";
vi.mock("server-only", () => ({}));
import { AI_RESPONSE_TIMEOUT_MS, MAX_TOKENS_BY_MODE, TITLE_GENERATION_TIMEOUT_MS, TITLE_MAX_TOKENS } from "./config";

describe("server AI generation configuration", () => {
  it("uses the intended per-mode ceilings", () => {
    expect(MAX_TOKENS_BY_MODE).toEqual({
      standard: 1024, concise: 512, detailed: 2048,
      creative: 1536, code: 2048, tutorial: 1536,
    });
  });
  it("uses separate response and title budgets", () => {
    expect(AI_RESPONSE_TIMEOUT_MS).toBe(600_000);
    expect(TITLE_GENERATION_TIMEOUT_MS).toBe(60_000);
    expect(TITLE_MAX_TOKENS).toBe(128);
  });
});
