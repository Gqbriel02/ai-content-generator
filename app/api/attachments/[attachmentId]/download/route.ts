import { z } from "zod";
import { requireSession } from "@/lib/auth/require-session";
import { findOwnedGeneratedAttachment } from "@/lib/db/chat-repo";
import { fail } from "@/lib/http/responses";
import { downloadAttachmentObject } from "@/lib/storage/attachments";

function extensionForMimeType(mimeType: string) {
  const extensions: Record<string, string> = {
    "image/webp": "webp",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
  };
  return extensions[mimeType] ?? "img";
}

export async function GET(_request: Request, ctx: { params: Promise<{ attachmentId: string }> }) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  const { attachmentId } = await ctx.params;
  if (!z.string().uuid().safeParse(attachmentId).success) return fail("Image not found.", 404);

  try {
    const attachment = await findOwnedGeneratedAttachment(auth.session.profileId, attachmentId);
    if (!attachment) return fail("Image not found.", 404);

    const object = await downloadAttachmentObject(attachment.storagePath);
    const bytes = await object.arrayBuffer();
    const shortId = attachment.id.slice(0, 8);
    return new Response(bytes, {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `attachment; filename="generated-image-${shortId}.${extensionForMimeType(attachment.mimeType)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Unable to download generated image.", error);
    return fail("The image could not be downloaded. Please try again.", 500);
  }
}
