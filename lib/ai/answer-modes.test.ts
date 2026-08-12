import { describe, expect, it } from "vitest";
import { getAnswerModeLabel } from "./answer-modes";

describe("getAnswerModeLabel", () => {
  it("keeps each assistant response label tied to its persisted mode", () => {
    const messages = [
      { answer_mode: "detailed" },
      { answer_mode: "concise" },
      { answer_mode: "creative" },
    ];

    expect(messages.map((message) => getAnswerModeLabel(message.answer_mode))).toEqual([
      "Detailed",
      "Concise",
      "Creative",
    ]);
  });

  it.each([null, undefined, "unknown"])('hides legacy or invalid mode "%s"', (answerMode) => {
    expect(getAnswerModeLabel(answerMode)).toBeNull();
  });
});
