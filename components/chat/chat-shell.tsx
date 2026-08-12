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
  Modal,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconFolderPlus,
  IconLogout,
  IconMessagePlus,
  IconPhoto,
  IconSend,
  IconSearch,
  IconThumbDown,
  IconThumbUp,
  IconX,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";
import {
  ANSWER_MODES,
  DEFAULT_ANSWER_MODE,
  getAnswerModeLabel,
  isAnswerMode,
  type AnswerMode,
} from "@/lib/ai/answer-modes";
import { HistoryChatItem } from "@/components/chat/history-chat-item";

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
  attachments?: { signedUrl: string; mimeType: string; storagePath: string }[];
};

type ChatShellProps = {
  chatId?: string;
};

function MarkdownView({ value }: { value: string }) {
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(value, { breaks: true }) as string), [value]);
  return <Box dangerouslySetInnerHTML={{ __html: html }} />;
}

export function ChatShell({ chatId }: ChatShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ chatId?: string }>();
  const activeChatId = typeof params.chatId === "string" ? params.chatId : chatId;
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [rating, setRating] = useState<1 | -1 | null>(null);
  const [ratingPending, setRatingPending] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [content, setContent] = useState("");
  const [answerMode, setAnswerMode] = useState<AnswerMode>(DEFAULT_ANSWER_MODE);
  const [navbarOpened, { toggle: toggleNavbar, close: closeNavbar }] = useDisclosure(false);
  const [asideOpened, { toggle: toggleAside }] = useDisclosure(false);
  const [pendingAttachments, setPendingAttachments] = useState<
    { storagePath: string; mimeType: string; sizeBytes: number; signedUrl: string }[]
  >([]);
  const [chatToDelete, setChatToDelete] = useState<Chat | null>(null);
  const [deletingChat, setDeletingChat] = useState(false);
  const deleteRequestPending = useRef(false);

  async function fetchBootstrap(nextSearch = search, nextSort = sort) {
    setLoading(true);
    setHistoryError(false);
    try {
      const query = new URLSearchParams();
      if (nextSearch) query.set("q", nextSearch);
      if (nextSort === "oldest") query.set("sort", "oldest");
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
    const chatJson = await chatRes.json();
    const messageJson = await messageRes.json();
    if (!chatRes.ok || !messageRes.ok) {
      throw new Error(messageJson?.error?.message ?? "Failed to load messages.");
    }
    setMessages(messageJson.data);
    setRating(chatJson.data.rating ?? null);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      const query = new URLSearchParams(window.location.search);
      const initialSearch = (query.get("q") ?? "").trim().slice(0, 200);
      const initialSort = query.get("sort") === "oldest" ? "oldest" : "newest";
      setSearchDraft(initialSearch);
      setSearch(initialSearch);
      setSort(initialSort);
      await fetchBootstrap(initialSearch, initialSort);
    })();
    return () => {
      cancelled = true;
    };
  // Bootstrap intentionally runs only once; subsequent history changes call fetchBootstrap explicitly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!activeChatId) {
        if (!cancelled) {
          setMessages([]);
          setRating(null);
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
    return `/chat/${targetChatId}${query.size ? `?${query}` : ""}`;
  }

  function applyHistoryQuery(nextSearch: string, nextSort: "newest" | "oldest") {
    const normalizedSearch = nextSearch.trim();
    setSearch(normalizedSearch);
    setSearchDraft(normalizedSearch);
    setSort(nextSort);
    const query = new URLSearchParams(window.location.search);
    if (normalizedSearch) query.set("q", normalizedSearch);
    else query.delete("q");
    if (nextSort === "oldest") query.set("sort", "oldest");
    else query.delete("sort");
    window.history.replaceState(null, "", `${window.location.pathname}${query.size ? `?${query}` : ""}`);
    void fetchBootstrap(normalizedSearch, nextSort);
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

  async function createFolder() {
    const name = window.prompt("Folder name");
    if (!name?.trim()) return;

    const response = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) return;
    await fetchBootstrap();
  }

  async function createChat() {
    const response = await fetch("/api/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Chat ${new Date().toLocaleString()}`,
        folderId: null,
      }),
    });
    const json = await response.json();
    if (!response.ok) return;
    router.push(`/chat/${json.data.id}`);
    router.refresh();
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

  async function uploadImage(file: File | null) {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/uploads", {
      method: "POST",
      body: formData,
    });
    const json = await response.json();
    if (!response.ok) {
      notifications.show({ color: "red", title: "Upload Failed", message: json?.error?.message });
      return;
    }

    setPendingAttachments((previous) => [...previous, json.data]);
  }

  async function sendMessage() {
    if (!activeChatId || !content.trim()) return;
    setSending(true);
    try {
      const response = await fetch(`/api/chats/${activeChatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          answerMode,
          attachments: pendingAttachments.map((item) => ({
            storagePath: item.storagePath,
            mimeType: item.mimeType,
            sizeBytes: item.sizeBytes,
          })),
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message ?? "The message could not be sent.");

      setContent("");
      setPendingAttachments([]);
      await fetchMessages(activeChatId);
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Error",
        message: error instanceof Error ? error.message : "An error occurred.",
      });
    } finally {
      setSending(false);
    }
  }

  function removePendingAttachment(storagePath: string) {
    setPendingAttachments((previous) =>
      previous.filter((attachment) => attachment.storagePath !== storagePath),
    );
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
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
            <Button leftSection={<IconFolderPlus size={16} />} variant="light" onClick={createFolder}>
              Folder
            </Button>
            <Button leftSection={<IconMessagePlus size={16} />} onClick={createChat}>
              New Chat
            </Button>
            <ActionIcon variant="subtle" onClick={logout} aria-label="Sign out">
              <IconLogout size={18} />
            </ActionIcon>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <Stack gap="sm">
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
          {historyError ? (
            <Stack gap="xs">
              <Text size="sm" c="red">History could not be loaded.</Text>
              <Button size="xs" variant="light" onClick={() => fetchBootstrap()}>Try again</Button>
            </Stack>
          ) : loading ? (
            <Group gap="xs"><Loader size="sm" /><Text size="sm">Loading history…</Text></Group>
          ) : chats.length === 0 ? (
            <Text size="sm" c="dimmed">
              {search ? "No history items match your search." : "No history yet. Create a chat to get started."}
            </Text>
          ) : null}
          <Text fw={600}>Folders</Text>
          {!loading && !historyError ? (
            folders.map((folder) => (
              <Box key={folder.id} p={8} style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 8 }}>
                <Text size="sm">{folder.name}</Text>
                <Stack gap={2} mt={6}>
                  {chats
                    .filter((chat) => chat.folder_id === folder.id)
                    .map((chat) => (
                      <HistoryChatItem
                        key={chat.id}
                        id={chat.id}
                        href={chatHref(chat.id)}
                        title={chat.title}
                        active={pathname === `/chat/${chat.id}`}
                        onSelect={closeNavbar}
                        onDelete={() => setChatToDelete(chat)}
                      />
                    ))}
                </Stack>
              </Box>
            ))
          ) : null}
          {!loading && !historyError ? <Text fw={600} mt="sm">
            No Folder
          </Text> : null}
          {!loading && !historyError ? <Stack gap={2}>
            {chats
              .filter((chat) => !chat.folder_id)
              .map((chat) => (
                <HistoryChatItem
                  key={chat.id}
                  id={chat.id}
                  href={chatHref(chat.id)}
                  title={chat.title}
                  active={pathname === `/chat/${chat.id}`}
                  onSelect={closeNavbar}
                  onDelete={() => setChatToDelete(chat)}
                />
              ))}
          </Stack> : null}
        </Stack>
      </AppShell.Navbar>

      <AppShell.Aside p="sm">
        <Stack gap="sm">
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
        </Stack>
      </AppShell.Aside>

      <AppShell.Main>
        {!activeChatId ? (
          <Stack align="center" justify="center" h="80vh">
            <Title order={2}>Select a chat or create a new one</Title>
          </Stack>
        ) : (
          <Stack gap="md" h="calc(100vh - 110px)">
            <ScrollArea type="auto" flex={1} offsetScrollbars style={{ backgroundColor: "#ffffff", borderRadius: 12 }}>
              <Stack gap="md" p="xs">
                {messages.map((message) => (
                  <Box
                    key={message.id}
                    p="md"
                    style={{
                      borderRadius: 12,
                      border: "1px solid var(--mantine-color-gray-3)",
                      background:
                        message.role === "user"
                          ? "var(--mantine-color-blue-0)"
                          : "var(--mantine-color-gray-0)",
                    }}
                  >
                    <Group justify="space-between" mb={8}>
                      <Badge variant="light">{message.role}</Badge>
                      {message.role === "assistant" && getAnswerModeLabel(message.answer_mode) ? (
                        <Badge variant="light" color="gray" radius="xl" size="sm">
                          {getAnswerModeLabel(message.answer_mode)}
                        </Badge>
                      ) : null}
                    </Group>
                    <MarkdownView value={message.content_text || ""} />
                    {message.attachments?.length ? (
                      <Group mt="sm">
                        {message.attachments.map((attachment) => (
                          <img
                            key={attachment.storagePath}
                            src={attachment.signedUrl}
                            alt="Attachment"
                            style={{ width: 150, borderRadius: 8 }}
                          />
                        ))}
                      </Group>
                    ) : null}
                  </Box>
                ))}
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
                  style={{ flex: 1 }}
                />
                <FileButton onChange={uploadImage} accept="image/png,image/jpeg,image/webp,image/gif">
                  {(props) => (
                    <ActionIcon variant="light" size="lg" {...props} aria-label="upload-image">
                      <IconPhoto size={18} />
                    </ActionIcon>
                  )}
                </FileButton>
                <ActionIcon size="lg" onClick={sendMessage} loading={sending} aria-label="send">
                  <IconSend size={18} />
                </ActionIcon>
              </Group>
            </Stack>
          </Stack>
        )}
      </AppShell.Main>

      <Modal
        opened={chatToDelete !== null}
        onClose={() => {
          if (!deletingChat) setChatToDelete(null);
        }}
        title="Delete chat?"
        centered
        closeOnClickOutside={!deletingChat}
        closeOnEscape={!deletingChat}
        withCloseButton={!deletingChat}
      >
        <Stack gap="lg">
          <Text size="sm">
            Are you sure you want to permanently delete this chat? This action cannot be undone.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setChatToDelete(null)} disabled={deletingChat} autoFocus>
              Cancel
            </Button>
            <Button color="red" onClick={deleteChat} loading={deletingChat} disabled={deletingChat}>
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </AppShell>
  );
}
