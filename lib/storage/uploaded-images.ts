import { uploadChatMedia } from "@/lib/storage/chat-media";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_UPLOAD_COUNT = 8;
const ACCEPTED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export type PendingImage = {
  bytes: ArrayBuffer;
  mimeType: string;
  sizeBytes: number;
  originalName: string;
};

function hasValidSignature(bytes: Uint8Array, mimeType: string) {
  if (mimeType === "image/png") return bytes.length >= 8 && bytes.slice(0, 8).every((v, i) => v === [137,80,78,71,13,10,26,10][i]);
  if (mimeType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;
  if (mimeType === "image/gif") return new TextDecoder().decode(bytes.slice(0, 6)) === "GIF87a" || new TextDecoder().decode(bytes.slice(0, 6)) === "GIF89a";
  if (mimeType === "image/webp") return new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  return false;
}

export async function validatePendingImages(files: File[]): Promise<PendingImage[]> {
  if (files.length > MAX_UPLOAD_COUNT) throw new Error("Too many attachments.");
  return Promise.all(files.map(async (file) => {
    if (!ACCEPTED.has(file.type) || !file.size || file.size > MAX_UPLOAD_BYTES) throw new Error("Invalid image attachment.");
    const bytes = await file.arrayBuffer();
    if (!hasValidSignature(new Uint8Array(bytes), file.type)) throw new Error("The attachment is not a valid image.");
    return { bytes, mimeType: file.type, sizeBytes: file.size, originalName: file.name };
  }));
}

export function pendingImageDataUrl(image: PendingImage) {
  return `data:${image.mimeType};base64,${Buffer.from(image.bytes).toString("base64")}`;
}

export async function persistUploadedImages(input: { profileId: string; chatId: string; images: PendingImage[] }) {
  const stored: { storagePath: string; mimeType: string; sizeBytes: number }[] = [];
  try {
    for (const image of input.images) {
      stored.push({
        storagePath: await uploadChatMedia({ profileId: input.profileId, chatId: input.chatId, kind: "uploaded", mimeType: image.mimeType, bytes: image.bytes }),
        mimeType: image.mimeType,
        sizeBytes: image.sizeBytes,
      });
    }
    return stored;
  } catch (error) {
    const { deleteAttachmentObjects } = await import("@/lib/storage/attachments");
    await deleteAttachmentObjects(stored.map((item) => item.storagePath)).catch(() => undefined);
    throw error;
  }
}
