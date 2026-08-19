import { randomUUID } from "node:crypto";
import { requireSession } from "@/lib/auth/require-session";
import { BflImageError } from "@/lib/ai/bfl";
import { IMAGE_ASPECT_RATIOS, IMAGE_MODEL_ID } from "@/lib/ai/image-config";
import { generateAndStoreImage } from "@/lib/ai/image-service";
import { resolveInitialChatTitle } from "@/lib/ai/chat-title";
import { findFolderById, persistInitialChatExchange } from "@/lib/db/chat-repo";
import { fail, ok } from "@/lib/http/responses";
import { hitRateLimit } from "@/lib/http/rate-limit";
import { deleteAttachmentObjects, createSignedReadUrl, GeneratedImageStorageError } from "@/lib/storage/attachments";
import { createInitialImageSchema } from "@/lib/validation/chat";

export async function POST(request: Request) {
  const imageRequestId = randomUUID();
  const auth = await requireSession(); if ("error" in auth) return auth.error;
  let body: unknown; try { body = await request.json(); } catch { return fail("The request body must contain valid JSON.", 400); }
  const parsed = createInitialImageSchema.safeParse(body);
  if (!parsed.success) return fail("Enter a valid image prompt and aspect ratio.", 400, parsed.error.flatten());
  console.info(`[image-generation] imageRequestId=${imageRequestId} stage=validation success`);
  if (parsed.data.folderId && !(await findFolderById(auth.session.profileId, parsed.data.folderId))) return fail("Folder not found.", 404);
  if (hitRateLimit(`image:${auth.session.profileId}`, 10)) return fail("The image service is busy. Please try again shortly.", 429);
  const dimensions = IMAGE_ASPECT_RATIOS[parsed.data.aspectRatio]; let attachment; let persisted = false;
  try {
    attachment = await generateAndStoreImage({ prompt: parsed.data.content, profileId: auth.session.profileId, imageRequestId, ...dimensions });
    const result = await persistInitialChatExchange({ profileId: auth.session.profileId, folderId: parsed.data.folderId,
      title: resolveInitialChatTitle({ userMessage: parsed.data.content }), modelName: IMAGE_MODEL_ID,
      userContent: parsed.data.content, assistantContent: "", assistantAnswerMode: null,
      attachments: [attachment], attachmentTarget: "assistant" });
    persisted = true; console.info(`[image-generation] imageRequestId=${imageRequestId} stage=db-persist success`);
    try {
      const signedUrl = await createSignedReadUrl(attachment.storagePath);
      console.info(`[image-generation] imageRequestId=${imageRequestId} stage=signed-url success`);
      return ok({ ...result, assistantMessage: { ...result.assistantMessage, attachments: [{ ...attachment, signedUrl }] } }, { status: 201 });
    } catch (error) {
      console.info(`[image-generation] imageRequestId=${imageRequestId} stage=signed-url failed code=${error instanceof Error ? error.name : "unknown"}`);
      return ok({ ...result, assistantMessage: { ...result.assistantMessage, content_text: "The image was saved, but it could not be displayed. Refresh the chat to try loading it again.", attachments: [] }, warning: { code: "IMAGE_SIGNED_URL_ERROR" } }, { status: 201 });
    }
  } catch (error) {
    if (attachment && !persisted) await deleteAttachmentObjects([attachment.storagePath]).catch((cleanupError) => console.error(`[image-generation] imageRequestId=${imageRequestId} stage=cleanup failed`, cleanupError));
    if (error instanceof BflImageError) return fail(error.message, error.status, undefined, error.code);
    if (error instanceof GeneratedImageStorageError) return fail(error.message, 500, undefined, error.code);
    console.error(`[image-generation] imageRequestId=${imageRequestId} stage=db-persist failed`, error);
    return fail("The image was generated, but the application could not save it.", 500, undefined, "IMAGE_PERSISTENCE_ERROR");
  }
}
