import { CHAT_TITLE_MAX_LENGTH } from "@/lib/validation/chat";

const GENERIC_TITLES = new Set(["new chat", "conversation", "user question", "ai response", "title"]);

export function sanitizeGeneratedChatTitle(value: string | null | undefined) {
  if (!value) return null;
  let title = value
    .replace(/^```(?:text)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/^\s*title\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .trim()
    .replace(/[.!?]+$/g, "")
    .trim();
  if (!title || title.includes("\n")) return null;
  title = title.slice(0, CHAT_TITLE_MAX_LENGTH).trim();
  if (!title || GENERIC_TITLES.has(title.toLocaleLowerCase())) return null;
  return title;
}

export function createPromptFallbackTitle(userMessage: string) {
  const cleaned = userMessage
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu, "")
    .trim();
  if (!cleaned) return null;
  const words = cleaned.split(" ").slice(0, 10);
  const title = words.map((word) => word ? word[0].toLocaleUpperCase() + word.slice(1) : word).join(" ");
  return title.slice(0, CHAT_TITLE_MAX_LENGTH).trim() || null;
}

export function resolveInitialChatTitle(input: {
  generatedTitle?: string | null;
  userMessage: string;
  now?: Date;
}) {
  return sanitizeGeneratedChatTitle(input.generatedTitle)
    ?? createPromptFallbackTitle(input.userMessage)
    ?? `Chat ${(input.now ?? new Date()).toLocaleString()}`.slice(0, CHAT_TITLE_MAX_LENGTH);
}
