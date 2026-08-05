import { describe, expect, it } from "vitest";
import { normalizeAssistantText } from "./response";

describe("normalizeAssistantText", () => {
  it("trims a valid model response", () => {
    expect(normalizeAssistantText("  Generated text  ")).toBe("Generated text");
  });

  it.each([undefined, null, "", "   \n\t  "])(
    "rejects an empty model response: %s",
    (value) => {
      expect(normalizeAssistantText(value)).toBeNull();
    },
  );
});
