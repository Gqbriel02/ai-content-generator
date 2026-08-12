"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button, Group, Modal, Stack, Text, TextInput } from "@mantine/core";
import { FOLDER_NAME_MAX_LENGTH } from "@/lib/validation/chat";

type Folder = { id: string; name: string };
type Props = { folder: Folder; opened: boolean; onClose: () => void; onRenamed: (folder: Folder) => void };

export function RenameFolderModal({ folder, opened, onClose, onRenamed }: Props) {
  const [name, setName] = useState(folder.name);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pending = useRef(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setError("Folder name is required."); return; }
    if (pending.current) return;
    pending.current = true; setSubmitting(true); setError(null);
    try {
      const response = await fetch(`/api/folders/${folder.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: trimmed }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message ?? "The folder could not be renamed.");
      onRenamed(json.data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The folder could not be renamed."); }
    finally { pending.current = false; setSubmitting(false); }
  }

  return (
    <Modal opened={opened} onClose={() => !submitting && onClose()} title="Rename folder" centered size="sm"
      closeOnEscape={!submitting} closeOnClickOutside={!submitting} withCloseButton={!submitting}>
      <form onSubmit={submit}><Stack gap="md">
        <Text size="sm" c="dimmed">Change the name of this folder.</Text>
        <TextInput label="Folder name" value={name} maxLength={FOLDER_NAME_MAX_LENGTH} error={error}
          disabled={submitting} data-autofocus onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => { setName(event.currentTarget.value); setError(null); }} />
        <Group justify="flex-end"><Button type="button" variant="default" disabled={submitting} onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={submitting} disabled={submitting || !name.trim()}>Rename</Button></Group>
      </Stack></form>
    </Modal>
  );
}
