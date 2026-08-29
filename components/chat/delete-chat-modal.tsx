"use client";

import { useState } from "react";
import { Button, Checkbox, Group, Modal, Stack, Text } from "@mantine/core";

type Props = { opened: boolean; deleting: boolean; onClose: () => void; onConfirm: () => void };

export function DeleteChatModal({ opened, deleting, onClose, onConfirm }: Props) {
  const [acknowledged, setAcknowledged] = useState(false);

  function close() {
    if (deleting) return;
    setAcknowledged(false);
    onClose();
  }

  return <Modal opened={opened} onClose={close} title="Delete chat?" centered
    closeOnClickOutside={!deleting} closeOnEscape={!deleting} withCloseButton={!deleting}>
    <Stack gap="lg">
      <Text size="sm">Are you sure you want to permanently delete this chat? This action cannot be undone.</Text>
      <Checkbox
        checked={acknowledged}
        onChange={(event) => setAcknowledged(event.currentTarget.checked)}
        disabled={deleting}
        label="I understand that this action is permanent."
      />
      <Group justify="flex-end">
        <Button variant="default" onClick={close} disabled={deleting} autoFocus>Cancel</Button>
        <Button color="red" onClick={onConfirm} loading={deleting} disabled={!acknowledged || deleting}>Delete</Button>
      </Group>
    </Stack>
  </Modal>;
}
