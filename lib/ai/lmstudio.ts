import OpenAI from "openai";
import { env } from "@/lib/config/env";
import type { Role, TaskCardPayload } from "@/types/domain";
import { taskCardJsonSchema } from "@/lib/ai/schemas";

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

function mapMessages(messages: LmMessage[]) {
  return messages.map((message) => {
    if (!message.attachments?.length) {
      return {
        role: message.role,
        content: message.contentText,
      };
    }

    const imageParts = message.attachments.map((attachment) => ({
      type: "image_url" as const,
      image_url: {
        url: attachment.dataUrl,
      },
    }));

    return {
      role: message.role,
      content: [{ type: "text" as const, text: message.contentText }, ...imageParts],
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
    "LM Studio is not responding. Check if the local server is running (lms server start) and if the model is loaded.";

  if (error instanceof LmStudioError) {
    return error;
  }

  if (error instanceof Error) {
    if (isConnectivityError(error)) {
      return new LmStudioError(fallback, 503);
    }

    return new LmStudioError(`Error LM Studio: ${error.message}`, 502);
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

    return completion.choices[0]?.message?.content ?? "";
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
