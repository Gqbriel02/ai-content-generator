"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  ActionIcon,
  AppShell,
  Badge,
  Box,
  Burger,
  Button,
  FileButton,
  Group,
  Loader,
  Menu,
  ScrollArea,
  Select,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  IconFolderPlus,
  IconLogout,
  IconMessagePlus,
  IconPhoto,
  IconUser,
  IconSend,
  IconSearch,
  IconSquare,
  IconThumbDown,
  IconThumbUp,
  IconX,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import {
  ANSWER_MODES,
  DEFAULT_ANSWER_MODE,
  isAnswerMode,
  type AnswerMode,
} from "@/lib/ai/answer-modes";
import { HistoryChatItem } from "@/components/chat/history-chat-item";
import { CreateFolderModal } from "@/components/chat/create-folder-modal";
import { HistoryFolderItem } from "@/components/chat/history-folder-item";
import { RenameFolderModal } from "@/components/chat/rename-folder-modal";
import { DeleteFolderModal } from "@/components/chat/delete-folder-modal";
import { DeleteChatModal } from "@/components/chat/delete-chat-modal";
import { RenameChatModal } from "@/components/chat/rename-chat-modal";
import { MoveChatModal } from "@/components/chat/move-chat-modal";
import { NoFolderDropZone } from "@/components/chat/no-folder-drop-zone";
import { deriveHistoryTree } from "@/components/chat/history-tree";
import type { HistoryContentFilter } from "@/types/domain";
import { MessageCard } from "@/components/chat/message-card";
import { createClientTemporaryId } from "@/lib/client/temporary-id";
import { readResponseJson } from "@/lib/http/client-response";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import type { SafeProfile } from "@/lib/profile/identity";

type Folder = {
  id: string;
  name: string;
};

type Chat = {
  id: string;
  title: string;
  folder_id: string | null;
  rating: 1 | -1 | null;
};

type Message = {
  id: string;
  role: "system" | "user" | "assistant" | "tool";
  content_text: string;
  answer_mode?: AnswerMode | null;
  attachments?: { id?: string; signedUrl: string | null; mimeType: string; storagePath: string; availability?: "available" | "unavailable" }[];
  generation_type?: "text" | "image";
  image_alt?: string;
};

type ChatShellProps = {
  chatId?: string;
  profile?: SafeProfile;
};

type DraftAttachment =
  | { source: "local"; id: string; file: File; mimeType: string; sizeBytes: number; signedUrl: string; storagePath: string }
  | { source: "existing"; id: string; attachmentId: string; mimeType: string; signedUrl: string; storagePath: string };

export function buildImageRequestForm(content: string, aspectRatio: string, folderId: string | null, attachments: DraftAttachment[]) {
  const form = new FormData();
  form.set("content", content); form.set("aspectRatio", aspectRatio);
  if (folderId) form.set("folderId", folderId);
  attachments.forEach((item) => item.source === "local"
    ? form.append("files", item.file, item.file.name)
    : form.append("referenceAttachmentIds", item.attachmentId));
  return form;
}

type PendingExchange = {
  requestId: number;
  ownerKey: string;
  content: string;
  answerMode: AnswerMode;
  generationType: "text" | "image";
  attachments: DraftAttachment[];
  status: "loading" | "error" | "canceled";
  errorMessage?: string;
};

export function ChatShell({ chatId, profile }: ChatShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ chatId?: string }>();
  const activeChatId = typeof params.chatId === "string" ? params.chatId : chatId;
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingExchange, setPendingExchange] = useState<PendingExchange | null>(null);
  const [draftFolderId, setDraftFolderId] = useState<string | null>(null);
  const [rating, setRating] = useState<1 | -1 | null>(null);
  const [activeChatFolderId, setActiveChatFolderId] = useState<string | null>(null);
  const [ratingPending, setRatingPending] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [historyType, setHistoryType] = useState<HistoryContentFilter>("all");
  const [content, setContent] = useState("");
  const [answerMode, setAnswerMode] = useState<AnswerMode>(DEFAULT_ANSWER_MODE);
  const [generationType, setGenerationType] = useState<"text" | "image">("text");
  const [aspectRatio, setAspectRatio] = useState<"1:1" | "16:9" | "9:16">("1:1");
  const [navbarOpened, { toggle: toggleNavbar, close: closeNavbar }] = useDisclosure(false);
  const [asideOpened, { toggle: toggleAside }] = useDisclosure(false);
  const [pendingAttachments, setPendingAttachments] = useState<DraftAttachment[]>([]);
  const [chatToDelete, setChatToDelete] = useState<Chat | null>(null);
  const [chatToRename, setChatToRename] = useState<Chat | null>(null);
  const [chatToMove, setChatToMove] = useState<Chat | null>(null);
  const [draggedChat, setDraggedChat] = useState<Chat | null>(null);
  const [movingChatIds, setMovingChatIds] = useState<Set<string>>(() => new Set());
  const [folderExpandSignals, setFolderExpandSignals] = useState<Record<string, number>>({});
  const [deletingChat, setDeletingChat] = useState(false);
  const [createFolderOpened, setCreateFolderOpened] = useState(false);
  const [folderToRename, setFolderToRename] = useState<Folder | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null);
  const [deletingFolder, setDeletingFolder] = useState(false);
  const deleteRequestPending = useRef(false);
  const folderDeletePending = useRef(false);
  const moveRequestsPending = useRef(new Set<string>());
  const requestSequence = useRef(0);
  const sendRequestPending = useRef(false);
  const activeTextRequest = useRef<{ requestId: number; controller: AbortController } | null>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const previewUrlsRef = useRef(new Set<string>());
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const historyTree = useMemo(
    () => deriveHistoryTree(folders, chats, search, historyType !== "all"),
    [folders, chats, search, historyType],
  );
  const hasSearchResults = historyTree.visibleFolders.length > 0 || historyTree.noFolderChats.length > 0;
  const historyFiltering = Boolean(search || historyType !== "all");
  const conversationOwnerKey = activeChatId ?? `draft:${draftFolderId ?? "no-folder"}`;
  const activeOwnerRef = useRef(conversationOwnerKey);
  activeOwnerRef.current = conversationOwnerKey;
  const visiblePendingExchange = pendingExchange?.ownerKey === conversationOwnerKey ? pendingExchange : null;

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, visiblePendingExchange?.status, visiblePendingExchange?.requestId]);

  useEffect(() => () => {
    activeTextRequest.current?.controller.abort();
    activeTextRequest.current = null;
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrlsRef.current.clear();
  }, []);

  function revokePreview(url: string) {
    if (!previewUrlsRef.current.has(url)) return;
    URL.revokeObjectURL(url);
    previewUrlsRef.current.delete(url);
  }

  async function moveChatToFolder(chat: Chat, destinationFolderId: string | null) {
    if (chat.folder_id === destinationFolderId || moveRequestsPending.current.has(chat.id)) return false;
    moveRequestsPending.current.add(chat.id);
    setMovingChatIds((current) => new Set(current).add(chat.id));
    try {
      const response = await fetch(`/api/chats/${chat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: destinationFolderId }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message ?? "The chat could not be moved.");
      setChats((current) => current.map((item) => item.id === chat.id
        ? { ...item, folder_id: json.data.folder_id }
        : item));
      if (activeChatId === chat.id) setActiveChatFolderId(json.data.folder_id);
      if (destinationFolderId) {
        setFolderExpandSignals((current) => ({
          ...current,
          [destinationFolderId]: (current[destinationFolderId] ?? 0) + 1,
        }));
      }
      return true;
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Chat not moved",
        message: error instanceof Error ? error.message : "The chat could not be moved. Please try again.",
      });
      await fetchBootstrap(search, sort, historyType);
      return false;
    } finally {
      moveRequestsPending.current.delete(chat.id);
      setMovingChatIds((current) => {
        const next = new Set(current);
        next.delete(chat.id);
        return next;
      });
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const chatId = event.active.data.current?.chatId;
    setDraggedChat(chats.find((chat) => chat.id === chatId) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const chat = draggedChat;
    setDraggedChat(null);
    if (!chat || !event.over || !String(event.over.id).startsWith("folder:")) return;
    const folderId = event.over.data.current?.folderId;
    if (folderId !== null && typeof folderId !== "string") return;
    void moveChatToFolder(chat, folderId);
  }

  async function fetchBootstrap(nextSearch = search, nextSort = sort, nextType = historyType) {
    setLoading(true);
    setHistoryError(false);
    try {
      const query = new URLSearchParams();
      if (nextSearch) query.set("q", nextSearch);
      if (nextSort === "oldest") query.set("sort", "oldest");
      if (nextType !== "all") query.set("type", nextType);
      const [folderRes, chatRes] = await Promise.all([
        fetch("/api/folders"),
        fetch(`/api/chats${query.size ? `?${query}` : ""}`),
      ]);
      const folderJson = await folderRes.json();
      const chatJson = await chatRes.json();

      if (!folderRes.ok || !chatRes.ok) throw new Error("Failed to load data.");
      setFolders(folderJson.data);
      setChats(chatJson.data);
    } catch (error) {
      setHistoryError(true);
      notifications.show({
        color: "red",
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to load data.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function fetchMessages(targetChatId: string) {
    const [chatRes, messageRes] = await Promise.all([
      fetch(`/api/chats/${targetChatId}`),
      fetch(`/api/chats/${targetChatId}/messages`),
    ]);
    const chatJson = await readResponseJson<{ data?: { rating?: 1 | -1 | null; folder_id?: string | null }; error?: { message?: string } }>(chatRes);
    const messageJson = await readResponseJson<{ data?: Message[]; error?: { message?: string } }>(messageRes);
    if (!chatRes.ok || !messageRes.ok) {
      throw new Error(messageJson?.error?.message ?? "Could not load the chat.");
    }
    setMessages(messageJson?.data ?? []);
    setRating(chatJson?.data?.rating ?? null);
    setActiveChatFolderId(chatJson?.data?.folder_id ?? null);
  }

  useEffect(() => {
    let cancelled = false;
    const restoreHistoryQuery = async () => {
      if (cancelled) return;
      const query = new URLSearchParams(window.location.search);
      const initialSearch = (query.get("q") ?? "").trim().slice(0, 200);
      const initialSort = query.get("sort") === "oldest" ? "oldest" : "newest";
      const initialType = query.get("type") === "text" || query.get("type") === "image"
        ? query.get("type") as HistoryContentFilter
        : "all";
      setSearchDraft(initialSearch);
      setSearch(initialSearch);
      setSort(initialSort);
      setHistoryType(initialType);
      await fetchBootstrap(initialSearch, initialSort, initialType);
    };
    void restoreHistoryQuery();
    window.addEventListener("popstate", restoreHistoryQuery);
    return () => {
      cancelled = true;
      window.removeEventListener("popstate", restoreHistoryQuery);
    };
  // The restore callback always supplies all three URL-derived values explicitly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!activeChatId) {
        if (!cancelled) {
          setMessages([]);
          setRating(null);
          setActiveChatFolderId(null);
        }
        return;
      }

      setRating(null);
      try {
        await fetchMessages(activeChatId);
      } catch (error) {
        if (!cancelled) {
          notifications.show({
            color: "red",
            title: "Error",
            message: error instanceof Error ? error.message : "An error occurred.",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeChatId]);

  function chatHref(targetChatId: string) {
    const query = new URLSearchParams();
    if (search) query.set("q", search);
    if (sort === "oldest") query.set("sort", "oldest");
    if (historyType !== "all") query.set("type", historyType);
    return `/chat/${targetChatId}${query.size ? `?${query}` : ""}`;
  }

  function applyHistoryQuery(nextSearch: string, nextSort: "newest" | "oldest", nextType = historyType) {
    const normalizedSearch = nextSearch.trim();
    setSearch(normalizedSearch);
    setSearchDraft(normalizedSearch);
    setSort(nextSort);
    setHistoryType(nextType);
    const query = new URLSearchParams(window.location.search);
    if (normalizedSearch) query.set("q", normalizedSearch);
    else query.delete("q");
    if (nextSort === "oldest") query.set("sort", "oldest");
    else query.delete("sort");
    if (nextType !== "all") query.set("type", nextType);
    else query.delete("type");
    window.history.pushState(null, "", `${window.location.pathname}${query.size ? `?${query}` : ""}`);
    void fetchBootstrap(normalizedSearch, nextSort, nextType);
  }

  async function updateRating(next: 1 | -1) {
    if (!activeChatId || ratingPending) return;
    const requestedRating = rating === next ? null : next;
    setRatingPending(true);
    try {
      const response = await fetch(`/api/chats/${activeChatId}/rating`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: requestedRating }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message ?? "The rating could not be saved.");
      setRating(json.data.rating);
      setChats((current) => current.map((chat) =>
        chat.id === activeChatId ? { ...chat, rating: json.data.rating } : chat,
      ));
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Rating not saved",
        message: error instanceof Error ? error.message : "The rating could not be saved. Please try again.",
      });
    } finally {
      setRatingPending(false);
    }
  }

  function createDraft(folderId: string | null = null) {
    if (!activeChatId && draftFolderId === folderId && !messages.length && !pendingExchange) return;
    pendingAttachments.forEach((item) => revokePreview(item.signedUrl));
    setDraftFolderId(folderId);
    setMessages([]);
    setRating(null);
    setActiveChatFolderId(null);
    setContent("");
    setPendingAttachments([]);
    setPendingExchange(null);
    router.push(`/chat${window.location.search}`);
  }

  async function deleteFolder() {
    if (!folderToDelete || folderDeletePending.current) return;
    const folder = folderToDelete;
    folderDeletePending.current = true; setDeletingFolder(true);
    try {
      const response = await fetch(`/api/folders/${folder.id}`, { method: "DELETE" });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message ?? "The folder could not be deleted.");
      setFolders((current) => current.filter((item) => item.id !== folder.id));
      setChats((current) => current.filter((chat) => chat.folder_id !== folder.id));
      setFolderToDelete(null);
      if (!activeChatId && draftFolderId === folder.id) setDraftFolderId(null);
      if (activeChatId && activeChatFolderId === folder.id) {
        setMessages([]); setRating(null); setActiveChatFolderId(null); router.push(`/chat${window.location.search}`);
      }
      notifications.show({ color: "green", title: "Folder deleted", message: `“${folder.name}” and its chats were permanently deleted.` });
    } catch (error) {
      notifications.show({ color: "red", title: "Folder not deleted", message: error instanceof Error ? error.message : "The folder could not be deleted." });
    } finally { folderDeletePending.current = false; setDeletingFolder(false); }
  }

  async function deleteChat() {
    if (!chatToDelete || deleteRequestPending.current) return;
    const deletedChatId = chatToDelete.id;
    deleteRequestPending.current = true;
    setDeletingChat(true);
    try {
      const response = await fetch(`/api/chats/${deletedChatId}`, { method: "DELETE" });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error?.message ?? "The chat could not be deleted.");
      }

      setChats((current) => current.filter((chat) => chat.id !== deletedChatId));
      setChatToDelete(null);
      if (deletedChatId === activeChatId) {
        setMessages([]);
        setRating(null);
        setActiveChatFolderId(null);
        router.push(`/chat${window.location.search}`);
      }
      notifications.show({
        color: "green",
        title: "Chat deleted",
        message: "The chat was permanently deleted.",
      });
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Chat not deleted",
        message: error instanceof Error ? error.message : "The chat could not be deleted. Please try again.",
      });
    } finally {
      deleteRequestPending.current = false;
      setDeletingChat(false);
    }
  }

  function uploadImage(file: File | null) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type) || file.size > 8 * 1024 * 1024) {
      notifications.show({ color: "red", title: "Attachment rejected", message: "Choose a PNG, JPEG, WebP, or GIF image up to 8 MB." });
      return;
    }
    if (pendingAttachments.length >= (generationType === "image" ? 4 : 8)) {
      notifications.show({ color: "red", title: "Attachment limit reached", message: generationType === "image" ? "Image mode supports up to four reference images." : "You can attach up to eight images." });
      return;
    }
    const id = createClientTemporaryId();
    const signedUrl = URL.createObjectURL(file);
    previewUrlsRef.current.add(signedUrl);
    setPendingAttachments((previous) => [...previous, { source: "local", id, file, mimeType: file.type, sizeBytes: file.size, signedUrl, storagePath: `local:${id}` }]);
  }

  function reuseGeneratedImage(reference: { attachmentId: string; previewUrl: string; mimeType: string }) {
    setGenerationType("image");
    setPendingAttachments((previous) => {
      if (previous.some((item) => item.source === "existing" && item.attachmentId === reference.attachmentId)) return previous;
      if (previous.length >= 4) {
        notifications.show({ color: "red", title: "Attachment limit reached", message: "Image mode supports up to four reference images." });
        return previous;
      }
      return [...previous, { source: "existing", id: reference.attachmentId, attachmentId: reference.attachmentId,
        mimeType: reference.mimeType, signedUrl: reference.previewUrl, storagePath: `existing:${reference.attachmentId}` }];
    });
  }

  async function sendMessage() {
    if (!content.trim() || sendRequestPending.current) return;
    sendRequestPending.current = true;
    const submittedContent = content;
    const submittedAnswerMode = answerMode;
    const submittedGenerationType = generationType;
    const submittedAttachments = [...pendingAttachments];
    const ownerKey = conversationOwnerKey;
    const requestId = ++requestSequence.current;
    const isInitial = !activeChatId;
    const textController = submittedGenerationType === "text" ? new AbortController() : null;
    if (textController) activeTextRequest.current = { requestId, controller: textController };
    setPendingExchange({
      requestId, ownerKey, content: submittedContent, answerMode: submittedAnswerMode, generationType: submittedGenerationType,
      attachments: submittedAttachments, status: "loading",
    });
    setContent("");
    setPendingAttachments([]);
    setSending(true);
    let responseErrorCode = "";
    let responseErrorMessage = "";
    try {
      const textForm = new FormData();
      textForm.set("content", submittedContent);
      textForm.set("answerMode", submittedAnswerMode);
      if (isInitial && draftFolderId) textForm.set("folderId", draftFolderId);
      submittedAttachments.forEach((item) => { if (item.source === "local") textForm.append("files", item.file, item.file.name); });
      const isImageRequest = submittedGenerationType === "image";
      const response = await fetch(isImageRequest
        ? (isInitial ? "/api/chats/initial-image-exchange" : `/api/chats/${activeChatId}/images`)
        : (isInitial ? "/api/chats/initial-exchange" : `/api/chats/${activeChatId}/messages`), {
        method: "POST",
        body: isImageRequest ? buildImageRequestForm(submittedContent, aspectRatio,
          isInitial ? draftFolderId : null, submittedAttachments) : textForm,
        ...(textController ? { signal: textController.signal } : {}),
      });
      const json = await response.json();
      responseErrorCode = typeof json?.error?.code === "string" ? json.error.code : "";
      responseErrorMessage = typeof json?.error?.message === "string" ? json.error.message : "";
      if (!response.ok) throw new Error(json?.error?.message ?? "The message could not be sent.");

      if (activeOwnerRef.current !== ownerKey) return;
      if (isInitial) {
        const createdChat = json.data.chat as Chat;
        setChats((current) => sort === "oldest" ? [...current, createdChat] : [createdChat, ...current]);
        setMessages([
          { ...json.data.userMessage, attachments: json.data.userMessage.attachments ?? [] },
          { ...json.data.assistantMessage, generation_type: submittedGenerationType, image_alt: submittedContent },
        ]);
        setPendingExchange(null);
        setActiveChatFolderId(createdChat.folder_id);
        setDraftFolderId(null);
        router.push(chatHref(createdChat.id));
      } else {
        setMessages((current) => [...current, json.data.userMessage, { ...json.data.assistantMessage, generation_type: submittedGenerationType, image_alt: submittedContent }]);
        setPendingExchange(null);
      }
      submittedAttachments.forEach((item) => revokePreview(item.signedUrl));
    } catch (error) {
      const wasCanceled = submittedGenerationType === "text" && textController?.signal.aborted === true;
      if (activeOwnerRef.current === ownerKey) {
        const code = responseErrorCode;
        const safeImageMessage = code === "BFL_SUBMISSION_UNCERTAIN" || code === "BFL_POLLING_ERROR" || code === "BFL_TIMEOUT"
          ? "The image request could not be confirmed. Please check before trying again."
          : code === "IMAGE_STORAGE_ERROR" || code === "IMAGE_PERSISTENCE_ERROR" || code === "BFL_DOWNLOAD_ERROR" || code === "IMAGE_VALIDATION_ERROR"
            ? "The image was generated, but the application could not save it."
            : code === "BFL_CONFIGURATION_ERROR" || code === "BFL_SUBMISSION_ERROR"
              ? responseErrorMessage || "The image service is temporarily unavailable."
              : submittedGenerationType === "image" ? "Image generation failed." : undefined;
        setPendingExchange((current) => current?.requestId === requestId
          ? wasCanceled
            ? { ...current, status: "canceled", errorMessage: undefined }
            : { ...current, status: "error", errorMessage: safeImageMessage }
          : current);
        setPendingAttachments(submittedAttachments);
      }
      if (!wasCanceled) {
        notifications.show({
          color: "red",
          title: "Error",
          message: error instanceof Error ? error.message : "An error occurred.",
        });
      }
    } finally {
      if (activeTextRequest.current?.requestId === requestId) activeTextRequest.current = null;
      sendRequestPending.current = false;
      setSending(false);
    }
  }

  function cancelTextGeneration() {
    const active = activeTextRequest.current;
    if (!active || pendingExchange?.requestId !== active.requestId || pendingExchange.generationType !== "text") return;
    active.controller.abort();
  }

  function removePendingAttachment(storagePath: string) {
    setPendingAttachments((previous) => {
      const removed = previous.find((attachment) => attachment.storagePath === storagePath);
      if (removed) revokePreview(removed.signedUrl);
      return previous.filter((attachment) => attachment.storagePath !== storagePath);
    });
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <DndContext sensors={dndSensors} autoScroll onDragStart={handleDragStart}
      onDragCancel={() => setDraggedChat(null)} onDragEnd={handleDragEnd}>
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 320,
        breakpoint: "lg",
        collapsed: { mobile: !navbarOpened },
      }}
      aside={{
        width: 320,
        breakpoint: "lg",
        collapsed: { mobile: !asideOpened },
      }}
      padding="md"
      styles={{
        main: {
          backgroundColor: "#f8fbff",
        },
        header: {
          backgroundColor: "#ffffff",
          borderBottom: "1px solid var(--mantine-color-gray-3)",
        },
        navbar: {
          backgroundColor: "#ffffff",
          borderRight: "1px solid var(--mantine-color-gray-3)",
          overflow: "hidden",
        },
        aside: {
          backgroundColor: "#ffffff",
          borderLeft: "1px solid var(--mantine-color-gray-3)",
        },
      }}
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger
              opened={navbarOpened}
              onClick={toggleNavbar}
              hiddenFrom="lg"
              size="sm"
              aria-label="Toggle folders panel"
            />
            <Title order={3}>AI Chat Studio</Title>
          </Group>
          <Group>
            <Burger
              opened={asideOpened}
              onClick={toggleAside}
              hiddenFrom="lg"
              size="sm"
              aria-label="Toggle settings panel"
            />
            <Button leftSection={<IconFolderPlus size={16} />} variant="light" onClick={() => setCreateFolderOpened(true)}>
              Folder
            </Button>
            <Button leftSection={<IconMessagePlus size={16} />} onClick={() => createDraft(null)}>
              New Chat
            </Button>
            <Menu position="bottom-end" shadow="md" width={180}>
              <Menu.Target>
                <UnstyledButton type="button" aria-label="Open profile menu" style={{ cursor: "pointer", borderRadius: "50%" }}>
                  <ProfileAvatar displayName={profile?.displayName} email={profile?.email}
                    avatarColor={profile?.avatarColor ?? "#228BE6"} avatarUrl={profile?.avatarUrl} size={36} />
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<IconUser size={16} />} onClick={() => router.push("/profile")}>Profile</Menu.Item>
                <Menu.Item leftSection={<IconLogout size={16} />} onClick={logout}>Logout</Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <Stack gap="sm" h="100%" style={{ minHeight: 0, overflow: "hidden" }}>
          <Text fw={600}>History</Text>
          <form onSubmit={(event) => { event.preventDefault(); applyHistoryQuery(searchDraft, sort); }}>
            <Group gap="xs" wrap="nowrap">
              <TextInput
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.currentTarget.value)}
                placeholder="Search history"
                aria-label="Search history"
                maxLength={200}
                leftSection={<IconSearch size={16} />}
                rightSection={searchDraft ? (
                  <ActionIcon
                    variant="subtle"
                    aria-label="Clear search"
                    onClick={() => applyHistoryQuery("", sort)}
                  ><IconX size={14} /></ActionIcon>
                ) : null}
                style={{ flex: 1 }}
              />
              <Button type="submit" variant="light" px="sm">Search</Button>
            </Group>
          </form>
          <Select
            aria-label="Sort history"
            value={sort}
            data={[
              { value: "newest", label: "Newest first" },
              { value: "oldest", label: "Oldest first" },
            ]}
            onChange={(value) => applyHistoryQuery(search, value === "oldest" ? "oldest" : "newest")}
            allowDeselect={false}
          />
          <SegmentedControl
            aria-label="Filter history by content type"
            value={historyType}
            fullWidth
            size="xs"
            onChange={(value) => applyHistoryQuery(
              search,
              sort,
              value === "text" || value === "image" ? value : "all",
            )}
            data={[
              { value: "all", label: "All" },
              { value: "text", label: "Text only" },
              { value: "image", label: "Images" },
            ]}
          />
          {historyError ? (
            <Stack gap="xs">
              <Text size="sm" c="red">History could not be loaded.</Text>
              <Button size="xs" variant="light" onClick={() => fetchBootstrap()}>Try again</Button>
            </Stack>
          ) : loading ? (
            <Group gap="xs"><Loader size="sm" /><Text size="sm">Loading history…</Text></Group>
          ) : !hasSearchResults ? (
            <Text size="sm" c="dimmed">
              {historyFiltering ? "No matching chats or folders." : "No history yet. Create a chat to get started."}
            </Text>
          ) : null}
          {(!historyFiltering || historyTree.visibleFolders.length > 0) ? <Text fw={600}>Folders</Text> : null}
          {!loading && !historyError && (!historyFiltering || historyTree.visibleFolders.length > 0) ? (
            <ScrollArea.Autosize
              type="auto"
              scrollbars="y"
              mah="30dvh"
              offsetScrollbars
              viewportProps={{ "aria-label": "Folders", tabIndex: 0, style: { overflowX: "hidden" } }}
              classNames={{ content: "folders-scroll-content" }}
              styles={{
                content: {
                  display: "block",
                  width: "100%",
                  minWidth: 0,
                  maxWidth: "100%",
                  boxSizing: "border-box",
                },
              }}
              style={{ width: "100%", minWidth: 0, maxWidth: "100%", flexShrink: 1, minHeight: 0 }}
            >
              <Stack gap="sm" pr="xs" style={{ width: "100%", minWidth: 0, maxWidth: "100%", overflow: "hidden" }}>
                {historyTree.visibleFolders.map(({ folder, chats: folderChats }) => (
                  <HistoryFolderItem key={`${folder.id}:${folderExpandSignals[folder.id] ?? 0}`} name={folder.name} folderId={folder.id}
                    forceExpanded={Boolean(search && folderChats.length)}
                    onNewChat={() => createDraft(folder.id)} onRename={() => setFolderToRename(folder)}
                    onDelete={() => setFolderToDelete(folder)}>
                      {folderChats.map((chat) => (
                          <HistoryChatItem
                            key={chat.id}
                            id={chat.id}
                            href={chatHref(chat.id)}
                            title={chat.title}
                            active={pathname === `/chat/${chat.id}`}
                            folderId={chat.folder_id}
                            moving={movingChatIds.has(chat.id)}
                            onSelect={closeNavbar}
                            onRename={() => setChatToRename(chat)}
                            onMove={() => setChatToMove(chat)}
                            onDelete={() => setChatToDelete(chat)}
                          />
                        ))}
                  </HistoryFolderItem>
                ))}
              </Stack>
            </ScrollArea.Autosize>
          ) : null}
          {!loading && !historyError && (!historyFiltering || historyTree.noFolderChats.length > 0) ? (
            <NoFolderDropZone>
            <Text fw={600} px={4} py={2}>No Folder</Text>
            <ScrollArea
              type="auto"
              offsetScrollbars
              viewportProps={{ "aria-label": "Chat history", tabIndex: 0 }}
              style={{ flex: 1, minHeight: 0 }}
            >
              <Stack gap={2} pr="xs">
                {historyTree.noFolderChats.map((chat) => (
                    <HistoryChatItem
                      key={chat.id}
                      id={chat.id}
                      href={chatHref(chat.id)}
                      title={chat.title}
                      active={pathname === `/chat/${chat.id}`}
                      folderId={chat.folder_id}
                      moving={movingChatIds.has(chat.id)}
                      onSelect={closeNavbar}
                      onRename={() => setChatToRename(chat)}
                      onMove={() => setChatToMove(chat)}
                      onDelete={() => setChatToDelete(chat)}
                    />
                  ))}
              </Stack>
            </ScrollArea>
            </NoFolderDropZone>
          ) : null}
        </Stack>
      </AppShell.Navbar>

      <AppShell.Aside p="sm">
        <Stack gap="sm">
          <Text fw={600}>Generation Type</Text>
          <SegmentedControl aria-label="Generation type" value={generationType} disabled={sending}
            onChange={(value) => setGenerationType(value === "image" ? "image" : "text")}
            data={[{ value: "text", label: "Text" }, { value: "image", label: "Image" }]} />
          {generationType === "text" ? <>
          <Text fw={600}>Answer Mode</Text>
          <Select
            aria-label="Answer mode"
            data={Object.entries(ANSWER_MODES).map(([value, mode]) => ({
              value,
              label: mode.label,
            }))}
            value={answerMode}
            onChange={(value) => setAnswerMode(isAnswerMode(value) ? value : DEFAULT_ANSWER_MODE)}
            allowDeselect={false}
          />
          <Text size="sm" fw={500}>
            {ANSWER_MODES[answerMode].label}
          </Text>
          <Text size="sm" c="dimmed">
            {ANSWER_MODES[answerMode].description}
          </Text>
          </> : <>
            <Text fw={600}>Image Generation</Text>
            <Text size="sm" c="dimmed">Model</Text><Text size="sm" fw={500}>FLUX.2 Klein 4B</Text>
            <Select aria-label="Aspect ratio" label="Aspect Ratio" value={aspectRatio} allowDeselect={false}
              disabled={sending} onChange={(value) => setAspectRatio(value === "16:9" || value === "9:16" ? value : "1:1")}
              data={["1:1", "16:9", "9:16"]} />
          </>}
        </Stack>
      </AppShell.Aside>

      <AppShell.Main>
        {!activeChatId && loading ? (
          <Stack align="center" justify="center" h="80vh">
            <Title order={2}>Select a chat or create a new one</Title>
          </Stack>
        ) : (
          <Stack gap="md" h="calc(100vh - 110px)">
            <ScrollArea type="auto" flex={1} offsetScrollbars style={{ backgroundColor: "#ffffff", borderRadius: 12 }}>
              <Stack gap="md" p="xs">
                {messages.map((message) => <MessageCard key={message.id} message={message} onReuseGeneratedImage={reuseGeneratedImage} />)}
                {visiblePendingExchange ? (
                  <>
                    <MessageCard message={{
                      role: "user", content_text: visiblePendingExchange.content,
                      attachments: visiblePendingExchange.attachments,
                    }} />
                    <MessageCard pendingStatus={visiblePendingExchange.status} pendingErrorMessage={visiblePendingExchange.errorMessage} message={{
                      role: "assistant", content_text: "", answer_mode: visiblePendingExchange.answerMode,
                      generation_type: visiblePendingExchange.generationType, image_alt: visiblePendingExchange.content,
                    }} />
                  </>
                ) : null}
                <div ref={conversationEndRef} aria-hidden="true" />
              </Stack>
            </ScrollArea>

            {messages.some((message) => message.role === "assistant") ? (
              <Group justify="flex-end" gap="xs">
                <Text size="sm" c="dimmed">Rate this response</Text>
                <ActionIcon
                  color="green"
                  variant={rating === 1 ? "filled" : "light"}
                  disabled={ratingPending}
                  onClick={() => updateRating(1)}
                  aria-label={rating === 1 ? "Remove positive rating" : "Rate this response positively"}
                ><IconThumbUp size={18} /></ActionIcon>
                <ActionIcon
                  color="red"
                  variant={rating === -1 ? "filled" : "light"}
                  disabled={ratingPending}
                  onClick={() => updateRating(-1)}
                  aria-label={rating === -1 ? "Remove negative rating" : "Rate this response negatively"}
                ><IconThumbDown size={18} /></ActionIcon>
              </Group>
            ) : null}

            <Stack gap="xs">
              {pendingAttachments.length ? (
                <Group>
                  {pendingAttachments.map((attachment) => (
                    <Box
                      key={attachment.storagePath}
                      style={{
                        position: "relative",
                        border: "1px solid var(--mantine-color-gray-3)",
                        borderRadius: 8,
                        padding: 4,
                        background: "#fff",
                      }}
                    >
                      {attachment.signedUrl ? (
                        <img
                          src={attachment.signedUrl}
                          alt="Preview"
                          style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 6 }}
                        />
                      ) : (
                        <Badge variant="light" leftSection={<IconPhoto size={12} />}>
                          Image attached
                        </Badge>
                      )}
                      <ActionIcon
                        color="red"
                        variant="filled"
                        size="sm"
                        aria-label="Remove image"
                        style={{ position: "absolute", top: -8, right: -8 }}
                        onClick={() => removePendingAttachment(attachment.storagePath)}
                      >
                        <IconX size={12} />
                      </ActionIcon>
                    </Box>
                  ))}
                </Group>
              ) : null}
              <Group align="flex-end">
                <Textarea
                  placeholder="Write a message..."
                  minRows={2}
                  autosize
                  value={content}
                  onChange={(event) => setContent(event.currentTarget.value)}
                  disabled={sending}
                  style={{ flex: 1 }}
                />
                <FileButton onChange={uploadImage} accept="image/png,image/jpeg,image/webp,image/gif" disabled={sending}>
                  {(props) => (
                    <ActionIcon variant="light" size="lg" {...props} aria-label="upload-image">
                      <IconPhoto size={18} />
                    </ActionIcon>
                  )}
                </FileButton>
                {sending && visiblePendingExchange?.generationType === "text" ? (
                  <ActionIcon size="lg" color="red" variant="light" onClick={cancelTextGeneration}
                    aria-label="Cancel generation" title="Cancel generation">
                    <IconSquare size={16} fill="currentColor" />
                  </ActionIcon>
                ) : (
                  <ActionIcon size="lg" onClick={sendMessage} loading={sending}
                    disabled={!content.trim()} aria-label="send">
                    <IconSend size={18} />
                  </ActionIcon>
                )}
              </Group>
            </Stack>
          </Stack>
        )}
      </AppShell.Main>

      <DeleteChatModal key={chatToDelete ? `chat-${chatToDelete.id}` : "chat-closed"} opened={chatToDelete !== null} deleting={deletingChat}
        onClose={() => setChatToDelete(null)} onConfirm={() => void deleteChat()} />
      {createFolderOpened ? (
        <CreateFolderModal
          opened
          onClose={() => setCreateFolderOpened(false)}
          onCreated={(folder) => setFolders((current) => [...current, folder])}
        />
      ) : null}
      {folderToRename ? <RenameFolderModal folder={folderToRename} opened onClose={() => setFolderToRename(null)}
        onRenamed={(folder) => { setFolders((current) => current.map((item) => item.id === folder.id ? { ...item, ...folder } : item)); setFolderToRename(null); notifications.show({ color: "green", title: "Folder renamed", message: `Folder renamed to “${folder.name}”.` }); }} /> : null}
      <DeleteFolderModal key={folderToDelete ? `folder-${folderToDelete.id}` : "folder-closed"} opened={folderToDelete !== null} deleting={deletingFolder}
        onClose={() => setFolderToDelete(null)} onConfirm={() => void deleteFolder()} />
      {chatToRename ? <RenameChatModal chat={chatToRename} onClose={() => setChatToRename(null)}
        onRenamed={(renamed) => {
          setChats((current) => current.map((chat) => chat.id === renamed.id ? { ...chat, title: renamed.title } : chat));
          setChatToRename(null);
          notifications.show({ color: "green", title: "Chat renamed", message: `Chat renamed to “${renamed.title}”.` });
        }} /> : null}
      {chatToMove ? <MoveChatModal chat={chatToMove} folders={folders} onClose={() => setChatToMove(null)}
        onFolderCreated={(folder) => setFolders((current) => [...current, folder])}
        onMove={moveChatToFolder} /> : null}
    </AppShell>
    <DragOverlay dropAnimation={null}>
      {draggedChat ? <Box px="sm" py={6} bg="white" style={{ borderRadius: 6, boxShadow: "var(--mantine-shadow-md)" }}>
        <Text size="sm" maw={240} truncate>{draggedChat.title}</Text>
      </Box> : null}
    </DragOverlay>
    </DndContext>
  );
}
