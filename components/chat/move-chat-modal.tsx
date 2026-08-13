"use client";

import { useCallback, useRef, useState } from "react";
import { Box, Button, Group, Modal, Radio, ScrollArea, Stack, Text, Tooltip } from "@mantine/core";
import { IconFolderPlus } from "@tabler/icons-react";
import { CreateFolderModal, type CreatedFolder } from "./create-folder-modal";

type Folder = { id: string; name: string };
type Chat = { id: string; title: string; folder_id: string | null; rating: 1 | -1 | null };

type Props = {
  chat: Chat;
  folders: Folder[];
  onClose: () => void;
  onFolderCreated: (folder: CreatedFolder) => void;
  onMove: (chat: Chat, folderId: string | null) => Promise<boolean>;
};

const NO_FOLDER = "__no_folder__";
const FOLDER_ROW_HEIGHT = 36;
const VISIBLE_FOLDER_ROWS = 4;
const FOLDER_LIST_MAX_HEIGHT = FOLDER_ROW_HEIGHT * VISIBLE_FOLDER_ROWS;

export function MoveChatModal({ chat, folders, onClose, onFolderCreated, onMove }: Props) {
  const [destination, setDestination] = useState(chat.folder_id ?? NO_FOLDER);
  const [moving, setMoving] = useState(false);
  const [creating, setCreating] = useState(false);
  const pending = useRef(false);
  const currentName = chat.folder_id
    ? folders.find((folder) => folder.id === chat.folder_id)?.name ?? "Unavailable folder"
    : "No Folder";
  const destinationId = destination === NO_FOLDER ? null : destination;
  const changed = destinationId !== chat.folder_id;

  const bringSelectedFolderIntoView = useCallback((node: HTMLDivElement | null) => {
    node?.scrollIntoView({ block: "nearest" });
  }, []);

  async function submitMove(folderId = destinationId) {
    if (pending.current || folderId === chat.folder_id) return false;
    pending.current = true;
    setMoving(true);
    try {
      const moved = await onMove(chat, folderId);
      if (moved) onClose();
      return moved;
    } finally {
      pending.current = false;
      setMoving(false);
    }
  }

  return (
    <>
      <Modal opened={!creating} onClose={onClose} title="Move chat" centered size="sm"
        closeOnEscape={!moving} closeOnClickOutside={!moving} withCloseButton={!moving}>
        <Stack gap="md">
          <Text size="sm">Move <Text span fw={600} lineClamp={2}>“{chat.title}”</Text></Text>
          <Text size="sm" c="dimmed">Current chat location: {currentName}</Text>
          <Radio.Group value={destination} onChange={setDestination} aria-label="Destination folder">
            <Stack gap="xs">
              <Radio value={NO_FOLDER} label="No Folder" disabled={moving} />
              {folders.length ? (
                <ScrollArea.Autosize
                  type="auto"
                  scrollbars="y"
                  mah={FOLDER_LIST_MAX_HEIGHT}
                  offsetScrollbars="present"
                  data-folder-scroll-area
                  viewportProps={{
                    "aria-label": "Existing folders",
                    style: { overflowX: "hidden" },
                  }}
                  styles={{
                    root: { width: "100%", minWidth: 0, maxWidth: "100%" },
                    content: {
                      display: "block",
                      width: "100%",
                      minWidth: 0,
                      maxWidth: "100%",
                      boxSizing: "border-box",
                    },
                  }}
                >
                  <Stack gap={0} style={{ width: "100%", minWidth: 0, maxWidth: "100%" }}>
                    {folders.map((folder) => (
                      <Box
                        key={folder.id}
                        ref={folder.id === chat.folder_id ? bringSelectedFolderIntoView : undefined}
                        data-folder-destination={folder.id}
                        h={FOLDER_ROW_HEIGHT}
                        style={{
                          width: "100%",
                          minWidth: 0,
                          maxWidth: "100%",
                          display: "flex",
                          alignItems: "center",
                          overflow: "hidden",
                        }}
                      >
                        <Radio
                          value={folder.id}
                          disabled={moving}
                          style={{ width: "100%", minWidth: 0, maxWidth: "100%" }}
                          label={(
                            <Tooltip label={folder.name} multiline maw={360} withinPortal>
                              <Text truncate data-folder-destination-label={folder.name}
                                style={{ display: "block", width: "100%", minWidth: 0 }}>
                                {folder.name}
                              </Text>
                            </Tooltip>
                          )}
                        />
                      </Box>
                    ))}
                  </Stack>
                </ScrollArea.Autosize>
              ) : null}
            </Stack>
          </Radio.Group>
          <Button variant="subtle" leftSection={<IconFolderPlus size={16} />} onClick={() => setCreating(true)}
            disabled={moving} style={{ alignSelf: "flex-start" }}>
            Create new folder
          </Button>
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose} disabled={moving}>Cancel</Button>
            <Button onClick={() => void submitMove()} loading={moving} disabled={!changed || moving}>Move</Button>
          </Group>
        </Stack>
      </Modal>
      {creating ? (
        <CreateFolderModal opened onClose={() => setCreating(false)} onCreated={async (folder) => {
          onFolderCreated(folder);
          setDestination(folder.id);
          await submitMove(folder.id);
        }} />
      ) : null}
    </>
  );
}
