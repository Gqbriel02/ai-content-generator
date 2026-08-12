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

const primaryClient = new OpenAI({
  baseURL: env.LM_STUDIO_BASE_URL,
  apiKey: env.LM_STUDIO_API_KEY,
});

const fallbackBaseUrl = env.LM_STUDIO_BASE_URL.includes("localhost")
  ? env.LM_STUDIO_BASE_URL.replace("localhost", "127.0.0.1")
  : null;

const fallbackClient = fallbackBaseUrl
  ? new OpenAI({
      baseURL: fallbackBaseUrl,
      apiKey: env.LM_STUDIO_API_KEY,
    })
  : null;

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

async function withLmStudioFallback<T>(run: (client: OpenAI) => Promise<T>) {
  try {
    return await run(primaryClient);
  } catch (error) {
    if (fallbackClient && isConnectivityError(error)) {
      return run(fallbackClient);
    }
    throw error;
  }
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
    const completion = await withLmStudioFallback((client) =>
      client.chat.completions.create({
        model: env.LM_STUDIO_MODEL,
        messages: [
          { role: "system", content: getSystemPrompt(answerMode) },
          ...mapMessages(messages.filter((message) => message.role !== "system")),
        ],
        temperature: 0.35,
      }),
    );

    const content = normalizeAssistantText(completion.choices[0]?.message?.content);
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
    const completion = await withLmStudioFallback((client) => client.chat.completions.create({
      model: env.LM_STUDIO_MODEL,
      messages: [
        { role: "system", content: getChatTitleSystemPrompt() },
        { role: "user", content: `USER:\n${input.userMessage}\n\nASSISTANT:\n${assistantExcerpt}` },
      ],
      temperature: 0.15,
    }));
    return normalizeAssistantText(completion.choices[0]?.message?.content);
  } catch (error) {
    throw mapLmStudioError(error);
  }
}
