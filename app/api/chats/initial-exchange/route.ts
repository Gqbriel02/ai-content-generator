import { requireSession } from "@/lib/auth/require-session";
import { findFolderById, persistInitialChatExchange } from "@/lib/db/chat-repo";
import { fail, ok } from "@/lib/http/responses";
import { hitRateLimit } from "@/lib/http/rate-limit";
import { createSignedReadUrl, deleteAttachmentObjects } from "@/lib/storage/attachments";
import { parseTextExchangeRequest } from "@/lib/http/text-exchange-request";
import { persistUploadedImages } from "@/lib/storage/uploaded-images";
import { createLmStudioImageDataUrl, LmStudioImagePreparationError } from "@/lib/ai/lmstudio-image";
import { generateAssistantReply, generateChatTitle, LmStudioError } from "@/lib/ai/lmstudio";
import { resolveInitialChatTitle } from "@/lib/ai/chat-title";

export async function POST(request: Request) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  let parsed;
  try { parsed = await parseTextExchangeRequest(request, true); } catch { return fail("Enter a valid message and image attachments.", 400); }
  if (parsed.folderId && !(await findFolderById(auth.session.profileId, parsed.folderId))) return fail("Folder not found.", 404);
  if (hitRateLimit(`chat:${auth.session.profileId}`, 40)) return fail("You have reached the request limit. Please try again in one minute.", 429);

  try {
    const attachments = await Promise.all(parsed.files.map(createLmStudioImageDataUrl));
    const assistantText = await generateAssistantReply([{ role: "user", contentText: parsed.content, attachments }], parsed.answerMode);
    let generatedTitle: string | null = null;
    try {
      generatedTitle = await generateChatTitle({ userMessage: parsed.content, assistantMessage: assistantText });
    } catch (error) {
      console.error("Unable to generate an initial chat title; using fallback.", error);
    }
    const title = resolveInitialChatTitle({ generatedTitle, userMessage: parsed.content });
    const chatId = randomUUID();
    const stored = await persistUploadedImages({ profileId: auth.session.profileId, chatId, images: parsed.files });
    let result;
    try { result = await persistInitialChatExchange({
      chatId, profileId: auth.session.profileId, folderId: parsed.folderId,
      title, modelName: process.env.LM_STUDIO_MODEL ?? "local-model",
      userContent: parsed.content, assistantContent: assistantText,
      assistantAnswerMode: parsed.answerMode, attachments: stored,
    }); } catch (error) { await deleteAttachmentObjects(stored.map((item) => item.storagePath)).catch(() => undefined); throw error; }
    try {
      const userAttachments = await Promise.all(stored.map(async (item) => ({ ...item, signedUrl: await createSignedReadUrl(item.storagePath) })));
      return ok({ ...result, userMessage: { ...result.userMessage, attachments: userAttachments } }, { status: 201 });
    } catch {
      return ok({ ...result, userMessage: { ...result.userMessage, attachments: [] }, warning: { code: "ATTACHMENT_SIGNED_URL_ERROR" } }, { status: 201 });
    }
  } catch (error) {
    if (error instanceof LmStudioImagePreparationError) return fail(error.message, 422);
    if (error instanceof LmStudioError) return fail(error.message, error.status);
    console.error("Unable to create initial chat exchange.", error);
    return fail("The generated response could not be saved. Please try again.", 500);
  }
}
import { randomUUID } from "node:crypto";
