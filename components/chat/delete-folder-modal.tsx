"use client";

import { Button, Group, Modal, Stack, Text } from "@mantine/core";

type Props = { opened: boolean; deleting: boolean; onClose: () => void; onConfirm: () => void };
export function DeleteFolderModal({ opened, deleting, onClose, onConfirm }: Props) {
  return (
    <Modal opened={opened} onClose={() => !deleting && onClose()} title="Delete folder?" centered
      closeOnEscape={!deleting} closeOnClickOutside={!deleting} withCloseButton={!deleting}>
      <Stack gap="lg">
        <Text size="sm">Are you sure you want to permanently delete this folder and all chats inside it? All messages and attachments contained in these chats will also be permanently deleted. This action cannot be undone.</Text>
        <Group justify="flex-end"><Button variant="default" onClick={onClose} disabled={deleting} autoFocus>Cancel</Button>
          <Button color="red" onClick={onConfirm} loading={deleting} disabled={deleting}>Delete folder</Button></Group>
      </Stack>
    </Modal>
  );
}
