"use client";

import { useState } from "react";
import { Button, Checkbox, Group, Modal, Stack, Text, TextInput } from "@mantine/core";

type Props = { opened: boolean; deleting: boolean; onClose: () => void; onConfirm: () => void };

export function DeleteAccountModal({ opened, deleting, onClose, onConfirm }: Props) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const canDelete = acknowledged && confirmation.trim() === "DELETE" && !deleting;

  function close() {
    if (deleting) return;
    setAcknowledged(false);
    setConfirmation("");
    onClose();
  }

  function confirm() {
    if (canDelete) onConfirm();
  }

  return <Modal opened={opened} onClose={close} title="Delete account?" centered
    closeOnClickOutside={!deleting} closeOnEscape={!deleting} withCloseButton={!deleting}>
    <form onSubmit={(event) => { event.preventDefault(); confirm(); }}>
      <Stack gap="lg">
        <Text size="sm">Deleting your account permanently removes your profile, folders, chats, messages, uploaded files, generated images, and profile photo. This action cannot be undone.</Text>
        <Checkbox checked={acknowledged} onChange={(event) => setAcknowledged(event.currentTarget.checked)} disabled={deleting}
          label="I understand that this will permanently delete my account and all associated data." />
        <TextInput label="Type DELETE to confirm" placeholder="DELETE" value={confirmation}
          onChange={(event) => setConfirmation(event.currentTarget.value)} disabled={deleting} />
        <Group justify="flex-end">
          <Button type="button" variant="default" onClick={close} disabled={deleting}>Cancel</Button>
          <Button type="submit" color="red" loading={deleting} disabled={!canDelete}>Delete account</Button>
        </Group>
      </Stack>
    </form>
  </Modal>;
}
