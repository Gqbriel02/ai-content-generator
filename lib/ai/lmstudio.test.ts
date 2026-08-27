import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ create: vi.fn(), constructor: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/config/env", () => ({ env: {
  LM_STUDIO_BASE_URL: "http://localhost:1234/v1", LM_STUDIO_API_KEY: "test", LM_STUDIO_MODEL: "test-model",
} }));
vi.mock("openai", () => {
  class APIConnectionTimeoutError extends Error {}
  class MockOpenAI {
    static APIConnectionTimeoutError = APIConnectionTimeoutError;
    chat = { completions: { create: mocks.create } };
    constructor(options: unknown) { mocks.constructor(options); }
  }
  return { default: MockOpenAI };
});

import { generateAssistantReply, generateChatTitle } from "./lmstudio";

describe("LM Studio request reliability", () => {
  beforeEach(() => { mocks.create.mockReset(); });

  it("configures the SDK with zero retries and the main timeout", () => {
    expect(mocks.constructor).toHaveBeenCalledWith(expect.objectContaining({ maxRetries: 0, timeout: 600_000 }));
    expect(mocks.constructor).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["standard", 1024], ["concise", 512], ["detailed", 2048],
    ["creative", 1536], ["code", 2048], ["tutorial", 1536],
  ] as const)("uses one %s request capped at %i tokens", async (mode, maxTokens) => {
    mocks.create.mockResolvedValue({ choices: [{ message: { content: "Answer" }, finish_reason: "stop" }] });
    await expect(generateAssistantReply([{ role: "user", contentText: "Question" }], mode)).resolves.toBe("Answer");
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ max_tokens: maxTokens }), { timeout: 600_000, maxRetries: 0, signal: undefined });
  });

  it.each(["stop", "length"])("accepts non-empty content with finish_reason %s without retry", async (finishReason) => {
    mocks.create.mockResolvedValue({ choices: [{ message: { content: "Capped answer" }, finish_reason: finishReason }] });
    await expect(generateAssistantReply([{ role: "user", contentText: "Question" }], "standard")).resolves.toBe("Capped answer");
    expect(mocks.create).toHaveBeenCalledOnce();
  });

  it.each([new Error("connection error"), new Error("fetch failed")])("does not retry a failed main request", async (error) => {
    mocks.create.mockRejectedValue(error);
    await expect(generateAssistantReply([{ role: "user", contentText: "Question" }], "standard")).rejects.toThrow();
    expect(mocks.create).toHaveBeenCalledOnce();
  });

  it("passes the AbortSignal through the SDK request options without retrying", async () => {
    const controller = new AbortController();
    const aborted = new DOMException("This operation was aborted", "AbortError");
    mocks.create.mockImplementation(async (_body, options) => {
      expect(options).toEqual({ timeout: 600_000, maxRetries: 0, signal: controller.signal });
      controller.abort();
      throw aborted;
    });
    await expect(generateAssistantReply([{ role: "user", contentText: "Question" }], "standard", controller.signal))
      .rejects.toBe(aborted);
    expect(mocks.create).toHaveBeenCalledOnce();
  });

  it("uses one small independently timed title request", async () => {
    mocks.create.mockResolvedValue({ choices: [{ message: { content: "Useful Title" }, finish_reason: "stop" }] });
    await expect(generateChatTitle({ userMessage: "Question", assistantMessage: "Answer" })).resolves.toBe("Useful Title");
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ max_tokens: 128, temperature: 0.15 }), { timeout: 60_000, maxRetries: 0, signal: undefined });
  });
});
