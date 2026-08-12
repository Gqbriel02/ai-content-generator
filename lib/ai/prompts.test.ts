import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import type { AnswerMode } from "./answer-modes";
import { buildResponseBudgetInstruction, getChatTitleSystemPrompt, getSystemPrompt } from "./prompts";

const expectations: Array<[AnswerMode, number, string]> = [
  ["standard", 600, "balanced"],
  ["concise", 250, "shortest response"],
  ["detailed", 1250, "thorough explanation"],
  ["creative", 900, "originality"],
  ["code", 1250, "complete code blocks"],
  ["tutorial", 800, "sequential actions"],
];

describe("answer-mode system prompts", () => {
  it.each(expectations)("builds %s instructions with a %i-token soft target", (mode, target, behavior) => {
    const prompt = getSystemPrompt(mode);
    expect(prompt).toContain(behavior);
    expect(prompt).toContain(`approximately ${target} output tokens`);
    expect(prompt).toContain("upper planning guideline, not a minimum");
    expect(prompt).toContain("finish cleanly");
  });

  it("keeps tutorial proportional and completion-first", () => {
    const prompt = getSystemPrompt("tutorial");
    expect(prompt).toContain("keep simple procedures simple");
    expect(prompt).toContain("never start an optional section");
  });

  it("does not apply response budgets to title generation", () => {
    const titlePrompt = getChatTitleSystemPrompt();
    expect(titlePrompt).not.toContain("output tokens");
    expect(titlePrompt).not.toContain("planning guideline");
  });

  it("builds the shared instruction from the selected mode", () => {
    expect(buildResponseBudgetInstruction("concise")).toContain("250");
    expect(buildResponseBudgetInstruction("detailed")).toContain("1250");
  });
});
