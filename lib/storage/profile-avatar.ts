import { randomUUID } from "node:crypto";
import { createServerSupabaseClient } from "@/lib/db/supabase";
import { hasValidImageSignature, IMAGE_MIME_EXTENSIONS, type SupportedImageMimeType } from "@/lib/storage/image-validation";

export const PROFILE_MEDIA_BUCKET = "profile";
export const MAX_PROFILE_AVATAR_BYTES = 5 * 1024 * 1024;
export const PROFILE_AVATAR_MIME_TYPES = Object.keys(IMAGE_MIME_EXTENSIONS) as SupportedImageMimeType[];
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ProfileAvatarValidationError extends Error {}

export function buildProfileAvatarPath(profileId: string, mimeType: SupportedImageMimeType, objectId = randomUUID()) {
  if (!UUID_PATTERN.test(profileId) || !UUID_PATTERN.test(objectId)) throw new Error("Invalid profile avatar owner or object ID.");
  return `${profileId}/avatar/${objectId}.${IMAGE_MIME_EXTENSIONS[mimeType]}`;
}

export function isOwnedProfileAvatarPath(profileId: string, storagePath: string) {
  if (!UUID_PATTERN.test(profileId)) return false;
  const escaped = profileId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const objectUuid = "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
  return new RegExp(`^${escaped}/avatar/${objectUuid}\\.(?:jpeg|png|webp)$`, "i").test(storagePath);
}

export async function validateProfileAvatar(file: File) {
  if (!file.size) throw new ProfileAvatarValidationError("Profile photo cannot be empty.");
  if (file.size > MAX_PROFILE_AVATAR_BYTES) throw new ProfileAvatarValidationError("Profile photo must be 5 MB or smaller.");
  if (!PROFILE_AVATAR_MIME_TYPES.includes(file.type as SupportedImageMimeType)) {
    throw new ProfileAvatarValidationError("Profile photo must be JPEG, PNG, or WebP.");
  }
  const bytes = await file.arrayBuffer();
  if (!hasValidImageSignature(new Uint8Array(bytes), file.type)) {
    throw new ProfileAvatarValidationError("The selected file is not a valid JPEG, PNG, or WebP image.");
  }
  return { bytes, mimeType: file.type as SupportedImageMimeType };
}

export async function uploadProfileAvatar(profileId: string, image: { bytes: ArrayBuffer; mimeType: SupportedImageMimeType }) {
  const storagePath = buildProfileAvatarPath(profileId, image.mimeType);
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.storage.from(PROFILE_MEDIA_BUCKET).upload(storagePath, image.bytes, {
    contentType: image.mimeType,
    upsert: false,
  });
  if (error) throw error;
  return storagePath;
}

export async function removeProfileAvatarObject(profileId: string, storagePath: string) {
  if (!isOwnedProfileAvatarPath(profileId, storagePath)) throw new Error("Invalid profile avatar path.");
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.storage.from(PROFILE_MEDIA_BUCKET).remove([storagePath]);
  if (error) throw error;
}

export async function createProfileAvatarSignedUrl(profileId: string, storagePath: string) {
  if (!isOwnedProfileAvatarPath(profileId, storagePath)) throw new Error("Invalid profile avatar path.");
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.storage.from(PROFILE_MEDIA_BUCKET).createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error) throw error;
  return data.signedUrl;
}
