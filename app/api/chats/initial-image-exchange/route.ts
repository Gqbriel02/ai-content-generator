import { randomUUID } from "node:crypto";
import { requireSession } from "@/lib/auth/require-session";
import { BflImageError } from "@/lib/ai/bfl";
import { IMAGE_ASPECT_RATIOS, IMAGE_MODEL_ID } from "@/lib/ai/image-config";
import { generateAndStoreImage } from "@/lib/ai/image-service";
import { resolveInitialChatTitle } from "@/lib/ai/chat-title";
import { findAttachmentByMessage, findFolderById, persistInitialChatExchange } from "@/lib/db/chat-repo";
import { fail, ok } from "@/lib/http/responses";
import { hitRateLimit } from "@/lib/http/rate-limit";
import { deleteAttachmentObjects, createSignedReadUrl, GeneratedImageStorageError } from "@/lib/storage/attachments";
import { parseImageExchangeRequest } from "@/lib/http/image-exchange-request";
import { persistUploadedImages } from "@/lib/storage/uploaded-images";

export async function POST(request: Request) {
  const imageRequestId = randomUUID();
  const auth = await requireSession(); if ("error" in auth) return auth.error;
  let parsed; try { parsed = await parseImageExchangeRequest(request, true); }
  catch { return fail("Enter a valid image prompt, aspect ratio, and up to four image attachments.", 400); }
  console.info(`[image-generation] imageRequestId=${imageRequestId} stage=validation success`);
  if (parsed.folderId && !(await findFolderById(auth.session.profileId, parsed.folderId))) return fail("Folder not found.", 404);
  if (hitRateLimit(`image:${auth.session.profileId}`, 10)) return fail("The image service is busy. Please try again shortly.", 429);
  const dimensions = IMAGE_ASPECT_RATIOS[parsed.aspectRatio]; let attachment; let uploaded: Awaited<ReturnType<typeof persistUploadedImages>> = []; let persisted = false;
  const chatId = randomUUID();
  try {
    uploaded = await persistUploadedImages({ profileId: auth.session.profileId, chatId, images: parsed.files });
    attachment = await generateAndStoreImage({ prompt: parsed.content, sourceImages: parsed.files, profileId: auth.session.profileId, chatId, imageRequestId, ...dimensions });
    const result = await persistInitialChatExchange({ chatId, profileId: auth.session.profileId, folderId: parsed.folderId,
      title: resolveInitialChatTitle({ userMessage: parsed.content }), modelName: IMAGE_MODEL_ID,
      userContent: parsed.content, assistantContent: "", assistantAnswerMode: null,
      attachments: [attachment], attachmentTarget: "assistant", userAttachments: uploaded });
    persisted = true; console.info(`[image-generation] imageRequestId=${imageRequestId} stage=db-persist success`);
    try {
      const persistedAttachment = await findAttachmentByMessage(result.assistantMessage.id, attachment.storagePath);
      if (!persistedAttachment) throw new Error("The persisted attachment was not returned.");
      const signedUrl = await createSignedReadUrl(attachment.storagePath);
      console.info(`[image-generation] imageRequestId=${imageRequestId} stage=signed-url success`);
      const userAttachments = await Promise.all(uploaded.map(async (item) => ({ ...item, signedUrl: await createSignedReadUrl(item.storagePath) })));
      return ok({ ...result, userMessage: { ...result.userMessage, attachments: userAttachments }, assistantMessage: { ...result.assistantMessage, attachments: [{ ...attachment, id: persistedAttachment.id, signedUrl }] } }, { status: 201 });
    } catch (error) {
      console.info(`[image-generation] imageRequestId=${imageRequestId} stage=signed-url failed code=${error instanceof Error ? error.name : "unknown"}`);
      return ok({ ...result, assistantMessage: { ...result.assistantMessage, content_text: "The image was saved, but it could not be displayed. Refresh the chat to try loading it again.", attachments: [] }, warning: { code: "IMAGE_SIGNED_URL_ERROR" } }, { status: 201 });
    }
  } catch (error) {
    if (!persisted) await deleteAttachmentObjects([...uploaded.map((item) => item.storagePath), ...(attachment ? [attachment.storagePath] : [])]).catch((cleanupError) => console.error(`[image-generation] imageRequestId=${imageRequestId} stage=cleanup failed`, cleanupError));
    if (error instanceof BflImageError) return fail(error.message, error.status, undefined, error.code);
    if (error instanceof GeneratedImageStorageError) return fail(error.message, 500, undefined, error.code);
    console.error(`[image-generation] imageRequestId=${imageRequestId} stage=db-persist failed`, error);
    return fail("The image was generated, but the application could not save it.", 500, undefined, "IMAGE_PERSISTENCE_ERROR");
  }
}
