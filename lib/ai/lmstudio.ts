import OpenAI from "openai";
import type {
  ChatCompletionContentPart,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import { env } from "@/lib/config/env";
import type { Role } from "@/types/domain";
import { normalizeAssistantText } from "@/lib/ai/response";
import type { AnswerMode } from "@/lib/ai/answer-modes";
import { getChatTitleSystemPrompt, getSystemPrompt } from "@/lib/ai/prompts";
import {
  AI_RESPONSE_TIMEOUT_MS,
  MAX_TOKENS_BY_MODE,
  TITLE_GENERATION_TIMEOUT_MS,
  TITLE_MAX_TOKENS,
} from "@/lib/ai/config";

const primaryClient = new OpenAI({
  baseURL: env.LM_STUDIO_BASE_URL,
  apiKey: env.LM_STUDIO_API_KEY,
  maxRetries: 0,
  timeout: AI_RESPONSE_TIMEOUT_MS,
});

type LmMessage = {
  role: Role;
  contentText: string;
  attachments?: { dataUrl: string; mimeType: string }[];
};

export class LmStudioError extends Error {
  status: number;

  constructor(message: string, status = 503) {
    super(message);
    this.name = "LmStudioError";
    this.status = status;
  }
}

function mapMessages(messages: LmMessage[]): ChatCompletionMessageParam[] {
  return messages.map((message) => {
    if (message.role === "system") {
      return {
        role: "system",
        content: message.contentText,
      };
    }

    if (message.role === "assistant") {
      return {
        role: "assistant",
        content: message.contentText,
      };
    }

    if (message.role === "tool") {
      return {
        role: "user",
        content: message.contentText,
      };
    }

    if (!message.attachments?.length) {
      return {
        role: "user",
        content: message.contentText,
      };
    }

    const content: ChatCompletionContentPart[] = [
      { type: "text", text: message.contentText },
      ...message.attachments.map((attachment) => ({
        type: "image_url" as const,
        image_url: {
          url: attachment.dataUrl,
        },
      })),
    ];

    return {
      role: "user",
      content,
    };
  });
}

function isConnectivityError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const lowered = error.message.toLowerCase();
  return (
    lowered.includes("econnrefused") ||
    lowered.includes("connection error") ||
    lowered.includes("fetch failed") ||
    lowered.includes("enotfound") ||
    lowered.includes("econnreset")
  );
}

function mapLmStudioError(error: unknown) {
  const fallback =
    "Unable to connect to the local AI model. Check that LM Studio is running and the model is loaded.";

  if (error instanceof LmStudioError) {
    return error;
  }

  if (error instanceof Error) {
    if (error instanceof OpenAI.APIConnectionTimeoutError) {
      return new LmStudioError("The local AI model timed out. Please try again.", 504);
    }

    if (isConnectivityError(error)) {
      return new LmStudioError(fallback, 503);
    }

    return new LmStudioError("The local AI model returned an error. Please try again.", 502);
  }

  return new LmStudioError(fallback, 503);
}

export async function generateAssistantReply(messages: LmMessage[], answerMode: AnswerMode) {
  try {
    const maxTokens = MAX_TOKENS_BY_MODE[answerMode];
    console.info("AI generation started.", { mode: answerMode, maxTokens, timeoutMs: AI_RESPONSE_TIMEOUT_MS });
    const completion = await primaryClient.chat.completions.create({
        model: env.LM_STUDIO_MODEL,
        messages: [
          { role: "system", content: getSystemPrompt(answerMode) },
          ...mapMessages(messages.filter((message) => message.role !== "system")),
        ],
        temperature: 0.35,
        max_tokens: maxTokens,
      }, { timeout: AI_RESPONSE_TIMEOUT_MS, maxRetries: 0 });

    const choice = completion.choices[0];
    console.info("AI generation completed.", { finishReason: choice?.finish_reason ?? "unknown" });
    if (choice?.finish_reason === "length") {
      console.warn("AI response reached its configured token limit.", { mode: answerMode, maxTokens });
    }
    const content = normalizeAssistantText(choice?.message?.content);
    if (!content) {
      throw new LmStudioError("The local AI model returned an empty response. Please try again.", 502);
    }

    return content;
  } catch (error) {
    throw mapLmStudioError(error);
  }
}

export async function generateChatTitle(input: { userMessage: string; assistantMessage: string }) {
  try {
    const assistantExcerpt = input.assistantMessage.slice(0, 6000);
    const completion = await primaryClient.chat.completions.create({
      model: env.LM_STUDIO_MODEL,
      messages: [
        { role: "system", content: getChatTitleSystemPrompt() },
        { role: "user", content: `USER:\n${input.userMessage}\n\nASSISTANT:\n${assistantExcerpt}` },
      ],
      temperature: 0.15,
      max_tokens: TITLE_MAX_TOKENS,
    }, { timeout: TITLE_GENERATION_TIMEOUT_MS, maxRetries: 0 });
    console.info("AI title generation completed.", { finishReason: completion.choices[0]?.finish_reason ?? "unknown" });
    return normalizeAssistantText(completion.choices[0]?.message?.content);
  } catch (error) {
    throw mapLmStudioError(error);
  }
}
