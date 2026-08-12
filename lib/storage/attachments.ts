import { env } from "@/lib/config/env";
import { createServerSupabaseClient } from "@/lib/db/supabase";

export async function createSignedReadUrl(storagePath: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.storage
    .from(env.NEXT_PUBLIC_SUPABASE_BUCKET)
    .createSignedUrl(storagePath, 60 * 60);

  if (error) throw error;
  return data.signedUrl;
}

export async function createAttachmentDataUrl(storagePath: string, mimeType: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.storage.from(env.NEXT_PUBLIC_SUPABASE_BUCKET).download(storagePath);

  if (error) throw error;

  const arrayBuffer = await data.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return `data:${mimeType};base64,${base64}`;
}

export async function deleteAttachmentObjects(storagePaths: string[]) {
  if (!storagePaths.length) return;

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.storage
    .from(env.NEXT_PUBLIC_SUPABASE_BUCKET)
    .remove(storagePaths);

  if (error) throw error;
}
