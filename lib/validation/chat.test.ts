import { describe, expect, it } from "vitest";
import { createMessageSchema } from "./chat";

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
    }
  });
});
