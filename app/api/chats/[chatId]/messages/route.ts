import { requireSession } from "@/lib/auth/require-session";
import {
  addAttachments,
  createMessage,
  getChatById,
  listMessages,
} from "@/lib/db/chat-repo";
import { createServerSupabaseClient } from "@/lib/db/supabase";
import { fail, ok } from "@/lib/http/responses";
import { hitRateLimit } from "@/lib/http/rate-limit";
import { createMessageSchema } from "@/lib/validation/chat";
import { createAttachmentDataUrl, createSignedReadUrl } from "@/lib/storage/attachments";
import { generateAssistantReply, generateStructuredTask, LmStudioError } from "@/lib/ai/lmstudio";

type MappedMessage = {
  role: "system" | "user" | "assistant" | "tool";
  contentText: string;
  attachments: { dataUrl: string; mimeType: string }[];
};

async function mapConversationForModel(chatId: string, systemPrompt: string): Promise<MappedMessage[]> {
  const dbMessages = await listMessages(chatId);
  const output: MappedMessage[] = [
    {
      role: "system",
      contentText: systemPrompt,
      attachments: [],
    },
  ];

  for (const message of dbMessages) {
    const attachments = await Promise.all(
      (message.message_attachments ?? []).map(async (attachment: { storage_path: string; mime_type: string }) => ({
        dataUrl: await createAttachmentDataUrl(attachment.storage_path, attachment.mime_type),
        mimeType: attachment.mime_type,
      })),
    );

    output.push({
      role: message.role,
      contentText: message.content_text ?? "",
      attachments,
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
  const chat = await getChatById(auth.session.profileId, chatId);

  const body = await request.json();
  const parsed = createMessageSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Mesaj invalid.", 400, parsed.error.flatten());
  }

  const limiterKey = `chat:${auth.session.profileId}`;
  if (hitRateLimit(limiterKey, 40)) {
    return fail("Ai atins limita de cereri pe minut.", 429);
  }

  const userMessage = await createMessage({
    chatId,
    role: "user",
    contentText: parsed.data.content,
  });

  await addAttachments(userMessage.id, parsed.data.attachments);

  const messagesForModel = await mapConversationForModel(chatId, chat.system_prompt ?? "");
  let assistantText = "";
  let structuredPayload: unknown = null;

  try {
    if (parsed.data.mode === "task") {
      structuredPayload = await generateStructuredTask(messagesForModel);
      assistantText = "Am generat un card de task. Completeaza campurile si trimite raspunsul.";
    } else {
      assistantText = await generateAssistantReply(messagesForModel);
    }
  } catch (error) {
    if (error instanceof LmStudioError) {
      return fail(error.message, error.status);
    }
    return fail("Eroare la generarea raspunsului AI.", 500);
  }

  const assistantMessage = await createMessage({
    chatId,
    role: "assistant",
    contentText: assistantText,
    structuredPayload,
  });

  const supabase = createServerSupabaseClient();
  await supabase.from("chats").update({ updated_at: new Date().toISOString() }).eq("id", chatId);

  return ok({
    userMessage,
    assistantMessage,
  });
}
