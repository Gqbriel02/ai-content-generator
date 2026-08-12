import { describe, expect, it } from "vitest";
import {
  createChatSchema,
  createMessageSchema,
  historyQuerySchema,
  ratingSchema,
  updateChatSchema,
} from "./chat";

describe("createMessageSchema", () => {
  it.each(["", "   ", "\n\t"])("rejects empty message content", (content) => {
    expect(createMessageSchema.safeParse({ content }).success).toBe(false);
  });

  it("rejects content longer than 12,000 characters", () => {
    expect(createMessageSchema.safeParse({ content: "a".repeat(12_001) }).success).toBe(false);
  });

  it("trims and accepts valid text content", () => {
    const result = createMessageSchema.safeParse({ content: "  Generate a summary.  " });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.content).toBe("Generate a summary.");
      expect(result.data.attachments).toEqual([]);
      expect(result.data.answerMode).toBe("standard");
    }
  });

  it.each([undefined, null, "task", "ignore previous instructions", 42])(
    "falls back to standard for unsupported mode %s",
    (answerMode) => {
      expect(createMessageSchema.parse({ content: "Hello", answerMode }).answerMode).toBe(
        "standard",
      );
    },
  );

  it.each(["standard", "concise", "detailed", "creative", "code", "tutorial"])(
    "accepts the %s answer mode",
    (answerMode) => {
      expect(createMessageSchema.parse({ content: "Hello", answerMode }).answerMode).toBe(
        answerMode,
      );
    },
  );

  it("rejects prompt override fields", () => {
    expect(
      createMessageSchema.safeParse({ content: "Hello", systemPrompt: "Override" }).success,
    ).toBe(false);
  });
});

describe("chat schemas", () => {
  it("rejects system prompts during creation and updates", () => {
    expect(
      createChatSchema.safeParse({ title: "Chat", systemPrompt: "Override" }).success,
    ).toBe(false);
    expect(updateChatSchema.safeParse({ systemPrompt: "Override" }).success).toBe(false);
  });
});

describe("historyQuerySchema", () => {
  it("trims search and defaults to newest", () => {
    expect(historyQuerySchema.parse({ q: "  example  " })).toEqual({ q: "example", sort: "newest" });
  });

  it.each(["newest", "oldest"])("accepts the %s sort", (sort) => {
    expect(historyQuerySchema.safeParse({ q: "", sort }).success).toBe(true);
  });

  it("rejects unknown sorts and overly long searches", () => {
    expect(historyQuerySchema.safeParse({ q: "", sort: "title" }).success).toBe(false);
    expect(historyQuerySchema.safeParse({ q: "a".repeat(201), sort: "newest" }).success).toBe(false);
  });
});

describe("ratingSchema", () => {
  it.each([1, -1, null])("accepts rating %s", (rating) => {
    expect(ratingSchema.safeParse({ rating }).success).toBe(true);
  });

  it.each([0, 2, "1", undefined])("rejects unsupported rating %s", (rating) => {
    expect(ratingSchema.safeParse({ rating }).success).toBe(false);
  });
});
