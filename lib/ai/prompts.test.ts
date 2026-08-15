import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import type { AnswerMode } from "./answer-modes";
import { buildResponseBudgetInstruction, getChatTitleSystemPrompt, getSystemPrompt } from "./prompts";

const expectations: Array<[AnswerMode, number, string]> = [
  ["standard", 600, "balanced"],
  ["concise", 250, "shortest response"],
  ["detailed", 1250, "explanation in addition to the answer"],
  ["creative", 900, "originality"],
  ["code", 1250, "complete code blocks"],
  ["tutorial", 800, "sequence of meaningful steps"],
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
    expect(prompt).toContain("clear sequence of meaningful steps");
    expect(prompt).toContain("Always show relevant intermediate steps for calculations");
    expect(prompt).toContain("do not return only the final result unless the user explicitly asks");
    expect(prompt).toContain("answer only");
    expect(prompt).toContain("do not invent artificial decomposition");
    expect(prompt).toContain("Do not force steps for atomic factual");
    expect(prompt).toContain("not padding or artificial verbosity");
  });

  it("requires Detailed answers to explain even simple analytical results", () => {
    const prompt = getSystemPrompt("detailed");
    expect(prompt).toContain("explanation in addition to the answer");
    expect(prompt).toContain("useful intermediate calculations");
    expect(prompt).toContain("Even for a simple question");
    expect(prompt).toContain("do not return only a bare result unless the user explicitly asks");
    expect(prompt).toContain("answer only");
    expect(prompt).toContain("not artificially long or exhaustive");
  });

  it("makes mode requirements take precedence over proportional brevity", () => {
    const prompt = getSystemPrompt("tutorial");
    expect(prompt).toContain("always satisfy the behavioral requirements of the selected Answer Mode");
    expect(prompt).toContain("selected Answer Mode takes precedence over general brevity guidance");
    expect(prompt).toContain("economy rules without violating the selected Answer Mode's required style");
  });

  it("preserves Standard and Concise rather than imposing mandatory steps", () => {
    expect(getSystemPrompt("standard")).toContain("Keep simple requests simple");
    expect(getSystemPrompt("concise")).toContain("shortest response that is still correct and useful");
    expect(getSystemPrompt("standard")).not.toContain("Always show relevant intermediate steps for calculations");
    expect(getSystemPrompt("concise")).not.toContain("Always show relevant intermediate steps for calculations");
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
