import { z } from "zod";
import { randomUUID } from "node:crypto";
import { requireSession } from "@/lib/auth/require-session";
import { BflImageError } from "@/lib/ai/bfl";
import { IMAGE_ASPECT_RATIOS } from "@/lib/ai/image-config";
import { generateAndStoreImage } from "@/lib/ai/image-service";
import { findAttachmentByMessage, findChatById, persistImageChatExchange } from "@/lib/db/chat-repo";
import { fail, ok } from "@/lib/http/responses";
import { hitRateLimit } from "@/lib/http/rate-limit";
import { createSignedReadUrl, deleteAttachmentObjects, GeneratedImageStorageError } from "@/lib/storage/attachments";
import { createImageSchema } from "@/lib/validation/chat";

export async function POST(request: Request, ctx: RouteContext<"/api/chats/[chatId]/images">) {
  const imageRequestId = randomUUID();
  const auth = await requireSession(); if ("error" in auth) return auth.error; const { chatId } = await ctx.params;
  if (!z.string().uuid().safeParse(chatId).success) return fail("Chat not found.", 404);
  if (!(await findChatById(auth.session.profileId, chatId))) return fail("Chat not found.", 404);
  let body: unknown; try { body = await request.json(); } catch { return fail("The request body must contain valid JSON.", 400); }
  const parsed = createImageSchema.safeParse(body); if (!parsed.success) return fail("Enter a valid image prompt and aspect ratio.", 400, parsed.error.flatten());
  console.info(`[image-generation] imageRequestId=${imageRequestId} stage=validation success`);
  if (hitRateLimit(`image:${auth.session.profileId}`, 10)) return fail("The image service is busy. Please try again shortly.", 429);
  const dimensions = IMAGE_ASPECT_RATIOS[parsed.data.aspectRatio]; let attachment; let persisted = false;
  try {
    attachment = await generateAndStoreImage({ prompt: parsed.data.content, profileId: auth.session.profileId, chatId, imageRequestId, ...dimensions });
    const result = await persistImageChatExchange({ chatId, profileId: auth.session.profileId, userContent: parsed.data.content, attachment });
    persisted = true; console.info(`[image-generation] imageRequestId=${imageRequestId} stage=db-persist success`);
    try {
      const persistedAttachment = await findAttachmentByMessage(result.assistantMessage.id, attachment.storagePath);
      if (!persistedAttachment) throw new Error("The persisted attachment was not returned.");
      const signedUrl = await createSignedReadUrl(attachment.storagePath);
      console.info(`[image-generation] imageRequestId=${imageRequestId} stage=signed-url success`);
      return ok({ ...result, assistantMessage: { ...result.assistantMessage, attachments: [{ ...attachment, id: persistedAttachment.id, signedUrl }] } });
    } catch (error) {
      console.info(`[image-generation] imageRequestId=${imageRequestId} stage=signed-url failed code=${error instanceof Error ? error.name : "unknown"}`);
      return ok({ ...result, assistantMessage: { ...result.assistantMessage, content_text: "The image was saved, but it could not be displayed. Refresh the chat to try loading it again.", attachments: [] }, warning: { code: "IMAGE_SIGNED_URL_ERROR" } });
    }
  } catch (error) {
    if (attachment && !persisted) await deleteAttachmentObjects([attachment.storagePath]).catch((cleanupError) => console.error(`[image-generation] imageRequestId=${imageRequestId} stage=cleanup failed`, cleanupError));
    if (error instanceof BflImageError) return fail(error.message, error.status, undefined, error.code);
    if (error instanceof GeneratedImageStorageError) return fail(error.message, 500, undefined, error.code);
    console.error(`[image-generation] imageRequestId=${imageRequestId} stage=db-persist failed`, error);
    return fail("The image was generated, but the application could not save it.", 500, undefined, "IMAGE_PERSISTENCE_ERROR");
  }
}
