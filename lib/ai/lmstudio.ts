import OpenAI from "openai";
import type {
  ChatCompletionContentPart,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import { env } from "@/lib/config/env";
import type { Role, TaskCardPayload } from "@/types/domain";
import { taskCardJsonSchema } from "@/lib/ai/schemas";
import { normalizeAssistantText } from "@/lib/ai/response";

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

export async function generateAssistantReply(messages: LmMessage[]) {
  try {
    const completion = await withLmStudioFallback((client) =>
      client.chat.completions.create({
        model: env.LM_STUDIO_MODEL,
        messages: mapMessages(messages),
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

export async function generateStructuredTask(messages: LmMessage[]) {
  try {
    const completion = await withLmStudioFallback((client) =>
      client.chat.completions.create({
        model: env.LM_STUDIO_MODEL,
        messages: [
          ...mapMessages(messages),
          {
            role: "system",
            content:
              "Return a practical, concise task form based on the latest user request. Do not include explanations outside the JSON object.",
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: taskCardJsonSchema,
        },
        temperature: 0.2,
      }),
    );

    const raw = completion.choices[0]?.message?.content ?? "{}";
    return JSON.parse(raw) as TaskCardPayload;
  } catch (error) {
    throw mapLmStudioError(error);
  }
}
