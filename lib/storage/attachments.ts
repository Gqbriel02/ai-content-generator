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
