import { createServerSupabaseClient } from "@/lib/db/supabase";
import type { AttachmentInput, HistoryContentFilter } from "@/types/domain";
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

export async function findFolderById(profileId: string, folderId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("chat_folders").select("id")
    .eq("id", folderId).eq("profile_id", profileId).maybeSingle();
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
  messages?: {
    role?: string;
    content_text?: string;
    message_attachments?: { storage_path?: string; mime_type?: string }[] | null;
  }[] | null;
  [key: string]: unknown;
};

export function hasGeneratedAssistantImage(chat: HistoryChat) {
  return (chat.messages ?? []).some((message) =>
    message.role === "assistant" && (message.message_attachments ?? []).some((attachment) =>
      attachment.mime_type?.startsWith("image/") === true &&
      attachment.storage_path?.split("/").includes("generated") === true,
    ),
  );
}

export function filterAndSortChats(
  chats: HistoryChat[],
  search: string,
  sort: HistorySort,
  type: HistoryContentFilter = "all",
  limit = CHAT_HISTORY_LIMIT,
) {
  const needle = search.trim().toLocaleLowerCase();
  const searchMatches = needle
    ? chats.filter((chat) => chat.title.toLocaleLowerCase().includes(needle))
    : chats;
  const filtered = type === "all" ? searchMatches : searchMatches.filter((chat) =>
    type === "image" ? hasGeneratedAssistantImage(chat) : !hasGeneratedAssistantImage(chat),
  );

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
      const publicChat = { ...chat };
      delete publicChat.messages;
      return publicChat;
    });
}

export async function listChats(
  profileId: string,
  options: { search?: string; sort?: HistorySort; type?: HistoryContentFilter; limit?: number } = {},
) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("chats")
    .select("id, profile_id, folder_id, title, model_name, rating, created_at, updated_at, messages(role, message_attachments(storage_path, mime_type))")
    .eq("profile_id", profileId);
  if (error) throw error;
  return filterAndSortChats(
    (data ?? []) as HistoryChat[],
    options.search ?? "",
    options.sort ?? "newest",
    options.type ?? "all",
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

export async function moveOwnedChat(input: {
  profileId: string;
  chatId: string;
  folderId: string | null;
}) {
  if (input.folderId !== null) {
    const folder = await findFolderById(input.profileId, input.folderId);
    if (!folder) return null;
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("chats")
    .update({ folder_id: input.folderId })
    .eq("id", input.chatId)
    .eq("profile_id", input.profileId)
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
    .select("id, chat_id, role, content_text, answer_mode, created_at, message_attachments(*)")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function findAttachmentByMessage(messageId: string, storagePath: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("message_attachments")
    .select("id, storage_path, mime_type")
    .eq("message_id", messageId)
    .eq("storage_path", storagePath)
    .maybeSingle();
  if (error) throw error;
  return data;
}

type OwnedAttachmentRecord = {
  id: string;
  storage_path: string;
  mime_type: string;
  messages?: { role?: string; chats?: { profile_id?: string } | null } | null;
};

export async function findOwnedGeneratedAttachment(profileId: string, attachmentId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("message_attachments")
    .select("id, storage_path, mime_type, messages!inner(role, chats!inner(profile_id))")
    .eq("id", attachmentId)
    .eq("messages.role", "assistant")
    .eq("messages.chats.profile_id", profileId)
    .maybeSingle();
  if (error) throw error;

  const attachment = data as OwnedAttachmentRecord | null;
  if (!attachment || !attachment.mime_type.startsWith("image/") ||
      !attachment.storage_path.split("/").includes("generated")) return null;
  return {
    id: attachment.id,
    storagePath: attachment.storage_path,
    mimeType: attachment.mime_type,
  };
}

export async function findSameChatGeneratedAttachments(profileId: string, chatId: string, attachmentIds: string[]) {
  if (!attachmentIds.length) return [];
  const uniqueIds = [...new Set(attachmentIds)];
  if (uniqueIds.length !== attachmentIds.length) return null;
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("message_attachments")
    .select("id, storage_path, mime_type, width, height, size_bytes, messages!inner(chat_id, role, chats!inner(profile_id))")
    .in("id", uniqueIds)
    .eq("messages.chat_id", chatId)
    .eq("messages.role", "assistant")
    .eq("messages.chats.profile_id", profileId);
  if (error) throw error;

  const byId = new Map((data ?? []).map((attachment) => [attachment.id, attachment]));
  const expectedPrefix = `${profileId}/${chatId}/generated/`;
  const resolved = uniqueIds.map((id) => byId.get(id));
  if (resolved.some((attachment) => !attachment || !attachment.mime_type.startsWith("image/") ||
      !attachment.storage_path.startsWith(expectedPrefix))) return null;
  return resolved.map((attachment) => ({
    id: attachment!.id, storagePath: attachment!.storage_path, mimeType: attachment!.mime_type,
    width: attachment!.width ?? undefined, height: attachment!.height ?? undefined,
    sizeBytes: attachment!.size_bytes ?? undefined,
  }));
}

export async function createMessage(input: {
  chatId: string;
  role: "system" | "user" | "assistant" | "tool";
  contentText: string;
}) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("messages")
    .insert({
      chat_id: input.chatId,
      role: input.role,
      content_text: input.contentText,
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
  answer_mode: AnswerMode | null;
  created_at: string;
};

export async function persistChatExchange(input: {
  chatId: string;
  profileId: string;
  userContent: string;
  assistantContent: string;
  assistantAnswerMode: AnswerMode;
  attachments?: AttachmentInput[];
}) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc("persist_chat_exchange", {
    p_chat_id: input.chatId,
    p_profile_id: input.profileId,
    p_user_content: input.userContent,
    p_assistant_content: input.assistantContent,
    p_assistant_answer_mode: input.assistantAnswerMode,
    p_attachments: (input.attachments ?? []).map((attachment) => ({
      storage_path: attachment.storagePath, mime_type: attachment.mimeType,
      width: attachment.width ?? null, height: attachment.height ?? null, size_bytes: attachment.sizeBytes ?? null,
    })),
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

export async function persistInitialChatExchange(input: {
  chatId: string;
  profileId: string;
  folderId: string | null;
  title: string;
  modelName: string;
  userContent: string;
  assistantContent: string;
  assistantAnswerMode: AnswerMode | null;
  attachments: AttachmentInput[];
  attachmentTarget?: "user" | "assistant";
  userAttachments?: AttachmentInput[];
}) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc("persist_initial_chat_exchange", {
    p_chat_id: input.chatId,
    p_profile_id: input.profileId,
    p_folder_id: input.folderId,
    p_title: input.title,
    p_model_name: input.modelName,
    p_user_content: input.userContent,
    p_assistant_content: input.assistantContent,
    p_assistant_answer_mode: input.assistantAnswerMode,
    p_attachments: input.attachments.map((attachment) => ({
      storage_path: attachment.storagePath, mime_type: attachment.mimeType,
      width: attachment.width ?? null, height: attachment.height ?? null, size_bytes: attachment.sizeBytes ?? null,
    })),
    p_attachment_target: input.attachmentTarget ?? "user",
    p_user_attachments: (input.userAttachments ?? []).map((attachment) => ({
      storage_path: attachment.storagePath, mime_type: attachment.mimeType,
      width: attachment.width ?? null, height: attachment.height ?? null, size_bytes: attachment.sizeBytes ?? null,
    })),
  });
  if (error) throw error;
  const result = data as { chat?: Record<string, unknown>; userMessage?: PersistedMessage; assistantMessage?: PersistedMessage } | null;
  if (!result?.chat || !result.userMessage || !result.assistantMessage) throw new Error("The initial exchange was not returned by the database.");
  return result as { chat: Record<string, unknown>; userMessage: PersistedMessage; assistantMessage: PersistedMessage };
}

export async function persistImageChatExchange(input: {
  chatId: string; profileId: string; userContent: string; attachment: AttachmentInput; userAttachments?: AttachmentInput[];
}) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc("persist_image_chat_exchange", {
    p_chat_id: input.chatId, p_profile_id: input.profileId, p_user_content: input.userContent,
    p_attachment: { storage_path: input.attachment.storagePath, mime_type: input.attachment.mimeType,
      width: input.attachment.width ?? null, height: input.attachment.height ?? null,
      size_bytes: input.attachment.sizeBytes ?? null },
    p_user_attachments: (input.userAttachments ?? []).map((attachment) => ({
      storage_path: attachment.storagePath, mime_type: attachment.mimeType,
      width: attachment.width ?? null, height: attachment.height ?? null, size_bytes: attachment.sizeBytes ?? null,
    })),
  });
  if (error) throw error;
  const result = data as { userMessage?: PersistedMessage; assistantMessage?: PersistedMessage } | null;
  if (!result?.userMessage || !result.assistantMessage) throw new Error("The persisted image exchange was not returned by the database.");
  return result as { userMessage: PersistedMessage; assistantMessage: PersistedMessage };
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
