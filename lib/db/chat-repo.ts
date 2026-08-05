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

export async function findChatById(profileId: string, chatId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("chats")
    .select("*")
    .eq("id", chatId)
    .eq("profile_id", profileId)
    .maybeSingle();

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

type PersistedMessage = {
  id: string;
  chat_id: string;
  role: "user" | "assistant";
  content_text: string;
  structured_payload: unknown;
  created_at: string;
};

export async function persistChatExchange(input: {
  chatId: string;
  profileId: string;
  userContent: string;
  assistantContent: string;
  assistantPayload?: unknown;
}) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc("persist_chat_exchange", {
    p_chat_id: input.chatId,
    p_profile_id: input.profileId,
    p_user_content: input.userContent,
    p_assistant_content: input.assistantContent,
    p_assistant_payload: input.assistantPayload ?? null,
  });

  if (error) throw error;

  const result = data as
    | { userMessage?: PersistedMessage; assistantMessage?: PersistedMessage }
    | null;
  if (!result?.userMessage || !result.assistantMessage) {
    throw new Error("The persisted exchange was not returned by the database.");
  }

  return {
    userMessage: result.userMessage,
    assistantMessage: result.assistantMessage,
  };
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
