import { createServerSupabaseClient } from "@/lib/db/supabase";
import type { AttachmentInput } from "@/types/domain";

export async function listFolders(profileId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("chat_folders")
    .select("*")
    .eq("profile_id", profileId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function listChats(profileId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("chats")
    .select("*")
    .eq("profile_id", profileId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getChatById(profileId: string, chatId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("chats")
    .select("*")
    .eq("id", chatId)
    .eq("profile_id", profileId)
    .single();

  if (error) throw error;
  return data;
}

export async function listMessages(chatId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("messages")
    .select("*, message_attachments(*)")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createMessage(input: {
  chatId: string;
  role: "system" | "user" | "assistant" | "tool";
  contentText: string;
  structuredPayload?: unknown;
}) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("messages")
    .insert({
      chat_id: input.chatId,
      role: input.role,
      content_text: input.contentText,
      structured_payload: input.structuredPayload ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function addAttachments(messageId: string, attachments: AttachmentInput[]) {
  if (!attachments.length) return;
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("message_attachments").insert(
    attachments.map((attachment) => ({
      message_id: messageId,
      storage_path: attachment.storagePath,
      mime_type: attachment.mimeType,
      width: attachment.width ?? null,
      height: attachment.height ?? null,
      size_bytes: attachment.sizeBytes ?? null,
    })),
  );
  if (error) throw error;
}
