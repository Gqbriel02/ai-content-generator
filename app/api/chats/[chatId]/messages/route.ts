import { requireSession } from "@/lib/auth/require-session";
import {
  findChatById,
  getChatById,
  listMessages,
  persistChatExchange,
} from "@/lib/db/chat-repo";
import { fail, ok } from "@/lib/http/responses";
import { hitRateLimit } from "@/lib/http/rate-limit";
import { createSignedReadUrl, deleteAttachmentObjects } from "@/lib/storage/attachments";
import { parseTextExchangeRequest } from "@/lib/http/text-exchange-request";
import { persistUploadedImages } from "@/lib/storage/uploaded-images";
import { createLmStudioImageDataUrl, LmStudioImagePreparationError } from "@/lib/ai/lmstudio-image";
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
          async (attachment: { id: string; storage_path: string; mime_type: string }) => ({
            id: attachment.id,
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

  let parsed;
  try { parsed = await parseTextExchangeRequest(request, false); } catch { return fail("Enter a valid message and image attachments.", 400); }

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

  let assistantText = "";
  try {
    messagesForModel.push({
      role: "user",
      contentText: parsed.content,
      attachments: await Promise.all(parsed.files.map(createLmStudioImageDataUrl)),
    });
    assistantText = await generateAssistantReply(messagesForModel, parsed.answerMode);
  } catch (error) {
    if (error instanceof LmStudioImagePreparationError) return fail(error.message, 422);
    if (error instanceof LmStudioError) {
      return fail(error.message, error.status);
    }
    return fail("The AI response could not be generated. Please try again.", 500);
  }

  let exchange; let stored: Awaited<ReturnType<typeof persistUploadedImages>> = [];
  try {
    stored = await persistUploadedImages({ profileId: auth.session.profileId, chatId, images: parsed.files });
    exchange = await persistChatExchange({
      chatId,
      profileId: auth.session.profileId,
      userContent: parsed.content,
      assistantContent: assistantText,
      assistantAnswerMode: parsed.answerMode,
      attachments: stored,
    });
  } catch (error) {
    await deleteAttachmentObjects(stored.map((item) => item.storagePath)).catch(() => undefined);
    console.error("Unable to persist generated exchange.", error);
    return fail("The generated response could not be saved. Please try again.", 500);
  }

  let attachments: { storagePath: string; mimeType: string; sizeBytes: number; signedUrl: string }[] = [];
  let warning: { code: string } | undefined;
  try { attachments = await Promise.all(stored.map(async (item) => ({ ...item, signedUrl: await createSignedReadUrl(item.storagePath) }))); }
  catch { warning = { code: "ATTACHMENT_SIGNED_URL_ERROR" }; }
  return ok({ userMessage: { ...exchange.userMessage, attachments }, assistantMessage: exchange.assistantMessage, ...(warning ? { warning } : {}) });
}
