import { randomUUID } from "node:crypto";

export const CHAT_MEDIA_BUCKET = "chat";
export type ChatMediaKind = "uploaded" | "generated";

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function safeImageExtension(mimeType: string) {
  const extension = EXTENSIONS[mimeType.toLowerCase()];
  if (!extension) throw new Error("Unsupported image type.");
  return extension;
}

export function buildChatMediaPath(input: {
  profileId: string;
  chatId: string;
  kind: ChatMediaKind;
  extension: string;
  objectId?: string;
}) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(input.profileId) || !uuid.test(input.chatId)) throw new Error("Invalid media owner.");
  const extension = input.extension.toLowerCase().replace(/^\./, "");
  if (!/^[a-z0-9]{2,5}$/.test(extension)) throw new Error("Invalid media extension.");
  return `${input.profileId}/${input.chatId}/${input.kind}/${input.objectId ?? randomUUID()}.${extension}`;
}

export async function uploadChatMedia(input: {
  profileId: string;
  chatId: string;
  kind: ChatMediaKind;
  mimeType: string;
  bytes: ArrayBuffer;
}) {
  const storagePath = buildChatMediaPath({
    profileId: input.profileId,
    chatId: input.chatId,
    kind: input.kind,
    extension: safeImageExtension(input.mimeType),
  });
  const { createServerSupabaseClient } = await import("@/lib/db/supabase");
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.storage.from(CHAT_MEDIA_BUCKET).upload(storagePath, input.bytes, {
    contentType: input.mimeType,
    upsert: false,
  });
  if (error) throw new Error(`Chat media storage is unavailable: ${error.message}`);
  return storagePath;
}
