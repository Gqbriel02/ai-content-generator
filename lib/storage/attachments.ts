import { createServerSupabaseClient } from "@/lib/db/supabase";
import { CHAT_MEDIA_BUCKET, uploadChatMedia } from "@/lib/storage/chat-media";

const MAX_GENERATED_IMAGE_BYTES = 16 * 1024 * 1024;
const TRANSIENT_DOWNLOAD_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export class GeneratedImageStorageError extends Error {
  constructor(message: string, public readonly code: "BFL_DOWNLOAD_ERROR" | "IMAGE_VALIDATION_ERROR" | "IMAGE_STORAGE_ERROR") { super(message); }
}

export async function createSignedReadUrl(storagePath: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.storage
    .from(CHAT_MEDIA_BUCKET)
    .createSignedUrl(storagePath, 60 * 60);

  if (error) throw error;
  return data.signedUrl;
}

export async function createAttachmentDataUrl(storagePath: string, mimeType: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.storage.from(CHAT_MEDIA_BUCKET).download(storagePath);

  if (error) throw error;

  const arrayBuffer = await data.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return `data:${mimeType};base64,${base64}`;
}

export async function downloadAttachmentObject(storagePath: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.storage.from(CHAT_MEDIA_BUCKET).download(storagePath);
  if (error) throw error;
  return data;
}

export async function deleteAttachmentObjects(storagePaths: string[]) {
  if (!storagePaths.length) return;

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.storage
    .from(CHAT_MEDIA_BUCKET)
    .remove(storagePaths);

  if (error) throw error;
}

export async function downloadAndStoreGeneratedImage(input: {
  temporaryUrl: string; profileId: string; chatId: string; width: number; height: number; imageRequestId?: string;
  sleep?: (ms: number) => Promise<void>;
}) {
  const sleep = input.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let response: Response | undefined;
  console.info(`[image-generation] imageRequestId=${input.imageRequestId ?? "unknown"} stage=bfl-download started`);
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { response = await fetch(input.temporaryUrl); }
    catch { console.info(`[image-generation] imageRequestId=${input.imageRequestId ?? "unknown"} stage=bfl-download transient-failure network=true attempt=${attempt}`); }
    if (response?.ok) break;
    if (response && !TRANSIENT_DOWNLOAD_STATUS.has(response.status)) {
      console.info(`[image-generation] imageRequestId=${input.imageRequestId ?? "unknown"} stage=bfl-download failed status=${response.status}`);
      throw new GeneratedImageStorageError("The generated image could not be downloaded.", "BFL_DOWNLOAD_ERROR");
    }
    if (attempt < 3) await sleep(Math.min(500 * 2 ** (attempt - 1), 2000));
  }
  if (!response?.ok) throw new GeneratedImageStorageError("The generated image could not be downloaded after the image was generated.", "BFL_DOWNLOAD_ERROR");
  const mimeType = (response.headers.get("content-type") ?? "").split(";")[0].toLowerCase();
  if (!mimeType.startsWith("image/") || mimeType === "image/svg+xml") {
    console.info(`[image-generation] imageRequestId=${input.imageRequestId ?? "unknown"} stage=bfl-download failed mime=${mimeType || "missing"}`);
    throw new GeneratedImageStorageError("The generated file was not a valid image.", "IMAGE_VALIDATION_ERROR");
  }
  const declaredSize = Number(response.headers.get("content-length") ?? 0);
  if (declaredSize > MAX_GENERATED_IMAGE_BYTES) throw new GeneratedImageStorageError("The generated image was too large.", "IMAGE_VALIDATION_ERROR");
  const bytes = await response.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > MAX_GENERATED_IMAGE_BYTES) throw new GeneratedImageStorageError("The generated image was invalid or too large.", "IMAGE_VALIDATION_ERROR");
  console.info(`[image-generation] imageRequestId=${input.imageRequestId ?? "unknown"} stage=bfl-download success bytes=${bytes.byteLength} mime=${mimeType}`);
  let storagePath: string;
  try {
    storagePath = await uploadChatMedia({ profileId: input.profileId, chatId: input.chatId, kind: "generated", mimeType, bytes });
  } catch {
    console.info(`[image-generation] imageRequestId=${input.imageRequestId ?? "unknown"} stage=storage-upload failed`);
    throw new GeneratedImageStorageError("The image was generated, but the application could not save it.", "IMAGE_STORAGE_ERROR");
  }
  console.info(`[image-generation] imageRequestId=${input.imageRequestId ?? "unknown"} stage=storage-upload success path=${storagePath}`);
  return { storagePath, mimeType, sizeBytes: bytes.byteLength, width: input.width, height: input.height };
}
