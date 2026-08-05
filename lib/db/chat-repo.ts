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

export type HistorySort = "newest" | "oldest";

export const CHAT_HISTORY_LIMIT = 100;

type HistoryChat = {
  id: string;
  title: string;
  created_at: string;
  messages?: { content_text: string | null }[] | null;
  [key: string]: unknown;
};

export function filterAndSortChats(
  chats: HistoryChat[],
  search: string,
  sort: HistorySort,
  limit = CHAT_HISTORY_LIMIT,
) {
  const needle = search.trim().toLocaleLowerCase();
  const filtered = needle
    ? chats.filter((chat) =>
        chat.title.toLocaleLowerCase().includes(needle) ||
        (chat.messages ?? []).some((message) =>
          (message.content_text ?? "").toLocaleLowerCase().includes(needle),
        ),
      )
    : chats;

  return filtered
    .toSorted((left, right) => {
      const timestampDifference = Date.parse(left.created_at) - Date.parse(right.created_at);
      if (timestampDifference !== 0) {
        return sort === "oldest" ? timestampDifference : -timestampDifference;
      }
      return sort === "oldest"
        ? left.id.localeCompare(right.id)
        : right.id.localeCompare(left.id);
    })
    .slice(0, limit)
    .map((chat) => {
      const result = { ...chat };
      delete result.messages;
      return result;
    });
}

export async function listChats(
  profileId: string,
  options: { search?: string; sort?: HistorySort; limit?: number } = {},
) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("chats")
    .select("*, messages(content_text)")
    .eq("profile_id", profileId);
  if (error) throw error;
  return filterAndSortChats(
    (data ?? []) as HistoryChat[],
    options.search ?? "",
    options.sort ?? "newest",
    Math.min(options.limit ?? CHAT_HISTORY_LIMIT, CHAT_HISTORY_LIMIT),
  );
}

export async function updateChatRating(profileId: string, chatId: string, rating: 1 | -1 | null) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("chats")
    .update({ rating })
    .eq("id", chatId)
    .eq("profile_id", profileId)
    .select("rating")
    .maybeSingle();
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
