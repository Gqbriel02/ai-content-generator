export const ANSWER_MODES = {
  standard: {
    label: "Standard",
    description: "Gives a balanced, clear, and direct reply to your prompt.",
  },
  concise: {
    label: "Concise",
    description: "Keeps the response brief and drops extra details.",
  },
  detailed: {
    label: "Detailed",
    description:
      "Adds deep explanations, background information, examples, and relevant details.",
  },
  creative: {
    label: "Creative",
    description:
      "Focuses on storytelling, brainstorming, original ideas, and creative writing styles.",
  },
  code: {
    label: "Code",
    description:
      "Optimizes responses for programming and technical questions, with clean code blocks, technical explanations, and implementation details.",
  },
  tutorial: {
    label: "Step-by-Step",
    description: "Breaks processes and explanations into clear sequential actions.",
  },
} as const;

export type AnswerMode = keyof typeof ANSWER_MODES;

export const DEFAULT_ANSWER_MODE: AnswerMode = "standard";

export function isAnswerMode(value: unknown): value is AnswerMode {
  return typeof value === "string" && value in ANSWER_MODES;
}

export function getAnswerModeLabel(value: unknown) {
  return isAnswerMode(value) ? ANSWER_MODES[value].label : null;
}
