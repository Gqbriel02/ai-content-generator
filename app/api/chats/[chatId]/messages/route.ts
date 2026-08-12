import { requireSession } from "@/lib/auth/require-session";
import {
  findChatById,
  getChatById,
  listMessages,
  persistChatExchange,
} from "@/lib/db/chat-repo";
import { fail, ok } from "@/lib/http/responses";
import { hitRateLimit } from "@/lib/http/rate-limit";
import { createMessageSchema } from "@/lib/validation/chat";
import { createSignedReadUrl } from "@/lib/storage/attachments";
import { generateAssistantReply, LmStudioError } from "@/lib/ai/lmstudio";
import { z } from "zod";

type MappedMessage = {
  role: "system" | "user" | "assistant" | "tool";
  contentText: string;
  attachments: { dataUrl: string; mimeType: string }[];
};

async function mapConversationForModel(chatId: string): Promise<MappedMessage[]> {
  const dbMessages = await listMessages(chatId);
  const output: MappedMessage[] = [];

  for (const message of dbMessages) {
    if (message.role === "system") continue;
    output.push({
      role: message.role,
      contentText: message.content_text ?? "",
      attachments: [],
    });
  }

  return output;
}

export async function GET(_request: Request, ctx: RouteContext<"/api/chats/[chatId]/messages">) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  const { chatId } = await ctx.params;

  await getChatById(auth.session.profileId, chatId);
  const messages = await listMessages(chatId);

  const messagesWithUrls = await Promise.all(
    messages.map(async (message) => ({
      ...message,
      attachments: await Promise.all(
        (message.message_attachments ?? []).map(
          async (attachment: { storage_path: string; mime_type: string }) => ({
            storagePath: attachment.storage_path,
            mimeType: attachment.mime_type,
            signedUrl: await createSignedReadUrl(attachment.storage_path),
          }),
        ),
      ),
    })),
  );

  return ok(messagesWithUrls);
}

export async function POST(request: Request, ctx: RouteContext<"/api/chats/[chatId]/messages">) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  const { chatId } = await ctx.params;

  if (!z.string().uuid().safeParse(chatId).success) {
    return fail("Invalid chat identifier.", 400);
  }

  let chat;
  try {
    chat = await findChatById(auth.session.profileId, chatId);
  } catch (error) {
    console.error("Unable to verify chat ownership.", error);
    return fail("The chat could not be loaded. Please try again.", 500);
  }

  if (!chat) {
    return fail("Chat not found.", 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("The request body must contain valid JSON.", 400);
  }

  const parsed = createMessageSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Enter a non-empty message of no more than 12,000 characters.", 400, parsed.error.flatten());
  }

  if (parsed.data.attachments.length > 0) {
    return fail("Attachments are not supported for text generation.", 400);
  }

  const limiterKey = `chat:${auth.session.profileId}`;
  if (hitRateLimit(limiterKey, 40)) {
    return fail("You have reached the request limit. Please try again in one minute.", 429);
  }

  let messagesForModel: MappedMessage[];
  try {
    messagesForModel = await mapConversationForModel(chatId);
  } catch (error) {
    console.error("Unable to load conversation context.", error);
    return fail("The conversation could not be loaded. Please try again.", 500);
  }

  messagesForModel.push({
    role: "user",
    contentText: parsed.data.content,
    attachments: [],
  });

  let assistantText = "";
  try {
    assistantText = await generateAssistantReply(messagesForModel, parsed.data.answerMode);
  } catch (error) {
    if (error instanceof LmStudioError) {
      return fail(error.message, error.status);
    }
    return fail("The AI response could not be generated. Please try again.", 500);
  }

  let exchange;
  try {
    exchange = await persistChatExchange({
      chatId,
      profileId: auth.session.profileId,
      userContent: parsed.data.content,
      assistantContent: assistantText,
      assistantAnswerMode: parsed.data.answerMode,
    });
  } catch (error) {
    console.error("Unable to persist generated exchange.", error);
    return fail("The generated response could not be saved. Please try again.", 500);
  }

  return ok({
    userMessage: exchange.userMessage,
    assistantMessage: exchange.assistantMessage,
  });
}
