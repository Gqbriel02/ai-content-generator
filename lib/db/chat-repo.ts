import { createServerSupabaseClient } from "@/lib/db/supabase";
import type { AttachmentInput } from "@/types/domain";
import type { AnswerMode } from "@/lib/ai/answer-modes";

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

export async function createOwnedChat(input: {
  profileId: string;
  folderId?: string | null;
  title: string;
  modelName: string;
}) {
  const supabase = createServerSupabaseClient();
  if (input.folderId) {
    const { data: folder, error: folderError } = await supabase
      .from("chat_folders")
      .select("id")
      .eq("id", input.folderId)
      .eq("profile_id", input.profileId)
      .maybeSingle();
    if (folderError) throw folderError;
    if (!folder) return null;
  }

  const { data, error } = await supabase
    .from("chats")
    .insert({
      profile_id: input.profileId,
      folder_id: input.folderId ?? null,
      title: input.title,
      model_name: input.modelName,
    })
    .select("id, profile_id, folder_id, title, model_name, rating, created_at, updated_at")
    .single();
  if (error) throw error;
  return data;
}

export async function renameOwnedFolder(profileId: string, folderId: string, name: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("chat_folders")
    .update({ name })
    .eq("id", folderId)
    .eq("profile_id", profileId)
    .select("id, name, position, created_at")
    .maybeSingle();
  if (error) throw error;
  return data;
}

type FolderWithAttachments = {
  id: string;
  chats?: { messages?: { message_attachments?: ChatAttachmentRecord[] | null }[] | null }[] | null;
};

export async function deleteOwnedFolder(profileId: string, folderId: string) {
  const supabase = createServerSupabaseClient();
  const { data: folder, error: lookupError } = await supabase
    .from("chat_folders")
    .select("id, chats(messages(message_attachments(id, storage_path)))")
    .eq("id", folderId)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (!folder) return null;

  const attachments = ((folder as FolderWithAttachments).chats ?? []).flatMap((chat) =>
    (chat.messages ?? []).flatMap((message) => message.message_attachments ?? []),
  );
  const candidatePaths = [...new Set(attachments.map((attachment) => attachment.storage_path))];
  let exclusivePaths = candidatePaths;
  if (candidatePaths.length) {
    const { data: references, error: referenceError } = await supabase
      .from("message_attachments")
      .select("id, storage_path")
      .in("storage_path", candidatePaths);
    if (referenceError) throw referenceError;
    const ownedIds = new Set(attachments.map((attachment) => attachment.id));
    const sharedPaths = new Set(
      ((references ?? []) as ChatAttachmentRecord[])
        .filter((attachment) => !ownedIds.has(attachment.id))
        .map((attachment) => attachment.storage_path),
    );
    exclusivePaths = candidatePaths.filter((path) => !sharedPaths.has(path));
  }

  const { data: deleted, error: deleteError } = await supabase
    .from("chat_folders")
    .delete()
    .eq("id", folderId)
    .eq("profile_id", profileId)
    .select("id")
    .maybeSingle();
  if (deleteError) throw deleteError;
  return deleted ? { storagePaths: exclusivePaths } : null;
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
    .select("id, profile_id, folder_id, title, model_name, rating, created_at, updated_at, messages(content_text)")
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

export async function renameOwnedChat(profileId: string, chatId: string, title: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("chats")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", chatId)
    .eq("profile_id", profileId)
    .select("id, profile_id, folder_id, title, model_name, rating, created_at, updated_at")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getChatById(profileId: string, chatId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("chats")
    .select("id")
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
    .select("id")
    .eq("id", chatId)
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

type ChatAttachmentRecord = {
  id: string;
  storage_path: string;
};

type ChatWithAttachments = {
  id: string;
  messages?: { message_attachments?: ChatAttachmentRecord[] | null }[] | null;
};

export async function deleteOwnedChat(profileId: string, chatId: string) {
  const supabase = createServerSupabaseClient();
  const { data: chat, error: lookupError } = await supabase
    .from("chats")
    .select("id, messages(message_attachments(id, storage_path))")
    .eq("id", chatId)
    .eq("profile_id", profileId)
    .maybeSingle();

  if (lookupError) throw lookupError;
  if (!chat) return null;

  const attachments = ((chat as ChatWithAttachments).messages ?? []).flatMap(
    (message) => message.message_attachments ?? [],
  );
  const candidatePaths = [...new Set(attachments.map((attachment) => attachment.storage_path))];
  let exclusivePaths = candidatePaths;

  // A storage path is normally unique (uploads include a UUID), but only remove
  // objects that are not referenced outside this chat if legacy/shared rows exist.
  if (candidatePaths.length) {
    const { data: references, error: referenceError } = await supabase
      .from("message_attachments")
      .select("id, storage_path")
      .in("storage_path", candidatePaths);
    if (referenceError) throw referenceError;

    const ownedIds = new Set(attachments.map((attachment) => attachment.id));
    const sharedPaths = new Set(
      ((references ?? []) as ChatAttachmentRecord[])
        .filter((attachment) => !ownedIds.has(attachment.id))
        .map((attachment) => attachment.storage_path),
    );
    exclusivePaths = candidatePaths.filter((path) => !sharedPaths.has(path));
  }

  const { data: deleted, error: deleteError } = await supabase
    .from("chats")
    .delete()
    .eq("id", chatId)
    .eq("profile_id", profileId)
    .select("id")
    .maybeSingle();

  if (deleteError) throw deleteError;
  return deleted ? { storagePaths: exclusivePaths } : null;
}

export async function listMessages(chatId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("messages")
    .select("id, chat_id, role, content_text, structured_payload, answer_mode, created_at, message_attachments(*)")
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
  answer_mode: AnswerMode | null;
  created_at: string;
};

export async function persistChatExchange(input: {
  chatId: string;
  profileId: string;
  userContent: string;
  assistantContent: string;
  assistantAnswerMode: AnswerMode;
  assistantPayload?: unknown;
}) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc("persist_chat_exchange", {
    p_chat_id: input.chatId,
    p_profile_id: input.profileId,
    p_user_content: input.userContent,
    p_assistant_content: input.assistantContent,
    p_assistant_answer_mode: input.assistantAnswerMode,
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
