"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button, Group, Modal, Stack, TextInput } from "@mantine/core";
import { CHAT_TITLE_MAX_LENGTH } from "@/lib/validation/chat";

export type RenamedChat = { id: string; title: string; folder_id: string | null };
type Props = { chat: RenamedChat; onClose: () => void; onRenamed: (chat: RenamedChat) => void };

export function RenameChatModal({ chat, onClose, onRenamed }: Props) {
  const [title, setTitle] = useState(chat.title);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pending = useRef(false);
  const trimmed = title.trim();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!trimmed) { setError("Chat name is required."); return; }
    if (trimmed === chat.title.trim()) { onClose(); return; }
    if (pending.current) return;
    pending.current = true; setSubmitting(true); setError(null);
    try {
      const response = await fetch(`/api/chats/${chat.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: trimmed }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message ?? "The chat could not be renamed.");
      onRenamed(json.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The chat could not be renamed. Please try again.");
    } finally { pending.current = false; setSubmitting(false); }
  }

  return <Modal opened onClose={() => !submitting && onClose()} title="Rename chat" centered size="sm"
    closeOnEscape={!submitting} closeOnClickOutside={!submitting} withCloseButton={!submitting}>
    <form onSubmit={submit}><Stack gap="md">
      <TextInput label="Chat name" value={title} maxLength={CHAT_TITLE_MAX_LENGTH} error={error} disabled={submitting}
        data-autofocus onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => { setTitle(event.currentTarget.value); setError(null); }} />
      <Group justify="flex-end"><Button type="button" variant="default" disabled={submitting} onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={submitting} disabled={submitting || !trimmed || trimmed === chat.title.trim()}>Rename</Button></Group>
    </Stack></form>
  </Modal>;
}
