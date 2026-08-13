"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button, Group, Modal, Stack, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { FOLDER_NAME_MAX_LENGTH } from "@/lib/validation/chat";

export type CreatedFolder = {
  id: string;
  name: string;
};

type CreateFolderModalProps = {
  opened: boolean;
  onClose: () => void;
  onCreated: (folder: CreatedFolder) => void | Promise<void>;
};

export function CreateFolderModal({ opened, onClose, onCreated }: CreateFolderModalProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const requestPending = useRef(false);
  const trimmedName = name.trim();

  function closeModal() {
    if (requestPending.current) return;
    setName("");
    setError(null);
    onClose();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trimmedName || requestPending.current) return;

    requestPending.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error?.message ?? "The folder could not be created.");
      }

      await onCreated(json.data);
      setName("");
      onClose();
      notifications.show({
        color: "green",
        title: "Folder created",
        message: `“${json.data.name}” was added to your folders.`,
      });
    } catch (submissionError) {
      const message = submissionError instanceof Error
        ? submissionError.message
        : "The folder could not be created. Please try again.";
      setError(message);
      notifications.show({ color: "red", title: "Folder not created", message });
    } finally {
      requestPending.current = false;
      setSubmitting(false);
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={closeModal}
      title="Create new folder"
      centered
      size="sm"
      closeOnClickOutside={!submitting}
      closeOnEscape={!submitting}
      withCloseButton={!submitting}
    >
      <form onSubmit={submit}>
        <Stack gap="md">
          <Text size="sm" c="dimmed">Organize your chats into a folder.</Text>
          <TextInput
            label="Folder name"
            placeholder="e.g. Project..."
            value={name}
            onChange={(event) => {
              setName(event.currentTarget.value);
              if (error) setError(null);
            }}
            error={error}
            maxLength={FOLDER_NAME_MAX_LENGTH}
            disabled={submitting}
            data-autofocus
          />
          <Group justify="flex-end" mt="xs">
            <Button type="button" variant="default" onClick={closeModal} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} disabled={!trimmedName || submitting}>
              Create
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
