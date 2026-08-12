import { describe, expect, it } from "vitest";
import { CHAT_TITLE_MAX_LENGTH } from "@/lib/validation/chat";
import { createPromptFallbackTitle, resolveInitialChatTitle, sanitizeGeneratedChatTitle } from "./chat-title";

describe("chat title resolution", () => {
  it.each([
    ['  "How Water Electrolysis Works."  ', "How Water Electrolysis Works"],
    ["Title: Python Binary Search Function", "Python Binary Search Function"],
    ["```text\nReact Server Components\n```", "React Server Components"],
  ])("sanitizes generated output", (input, expected) => {
    expect(sanitizeGeneratedChatTitle(input)).toBe(expected);
  });

  it("enforces the centralized maximum length", () => {
    expect(sanitizeGeneratedChatTitle("A".repeat(200))?.length).toBe(CHAT_TITLE_MAX_LENGTH);
  });

  it.each(["", "   ", "New Chat", "Title:", "Conversation"])("rejects unusable generated title %j", (title) => {
    expect(sanitizeGeneratedChatTitle(title)).toBeNull();
  });

  it("falls back to a cleaned user prompt", () => {
    expect(resolveInitialChatTitle({ generatedTitle: "New Chat", userMessage: "  can you explain photosynthesis to me? " }))
      .toBe("Can You Explain Photosynthesis To Me");
  });

  it("uses a timestamp when both generated output and prompt are unusable", () => {
    expect(resolveInitialChatTitle({ generatedTitle: "", userMessage: "???", now: new Date("2026-01-01T00:00:00Z") }))
      .toMatch(/^Chat /);
  });

  it("keeps fallback titles concise", () => {
    expect(createPromptFallbackTitle("one two three four five six seven eight nine ten eleven twelve")?.split(" ")).toHaveLength(10);
  });
});
