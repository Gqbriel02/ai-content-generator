"use client";

import { ActionIcon, Box, Collapse, Group, Menu, Stack, Text, Tooltip } from "@mantine/core";
import { IconChevronDown, IconChevronUp, IconDotsVertical, IconEdit, IconMessagePlus, IconTrash } from "@tabler/icons-react";
import { Children, useId, useState, type ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";

type Props = {
  name: string;
  children: ReactNode;
  onNewChat: () => void;
  onRename: () => void;
  onDelete: () => void;
  folderId?: string;
  forceExpanded?: boolean;
};

export function HistoryFolderItem({ name, children, onNewChat, onRename, onDelete, folderId = name, forceExpanded = false }: Props) {
  const [expanded, setExpanded] = useState(true);
  const { setNodeRef, isOver } = useDroppable({ id: `folder:${folderId}`, data: { folderId } });
  const contentId = useId();
  const hasChats = Children.count(children) > 0;
  const visiblyExpanded = forceExpanded || expanded;
  return (
    <Box ref={setNodeRef} p={8} data-folder-drop-id={folderId} style={{
      border: `1px solid ${isOver ? "var(--mantine-color-blue-5)" : "var(--mantine-color-gray-3)"}`,
      background: isOver ? "var(--mantine-color-blue-0)" : undefined, borderRadius: 8,
      width: "100%", minWidth: 0, maxWidth: "100%", overflow: "hidden",
    }}>
      <Group gap={4} wrap="nowrap" style={{ width: "100%", minWidth: 0, maxWidth: "100%" }}>
        <Tooltip label={name} multiline maw={360} withinPortal>
          <Text size="sm" truncate data-folder-name={name} data-tooltip-label={name}
            style={{ flex: "1 1 0", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {name}
          </Text>
        </Tooltip>
        <Tooltip label={hasChats ? (visiblyExpanded ? "Collapse folder" : "Expand folder") : "No chats in this folder"}>
          <span
            title={hasChats ? undefined : "No chats in this folder"}
            style={{ display: "inline-flex", flexShrink: 0, cursor: hasChats ? undefined : "not-allowed" }}
          >
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              disabled={!hasChats}
              aria-label={hasChats ? `${visiblyExpanded ? "Collapse" : "Expand"} ${name}` : `No chats in ${name}`}
              aria-expanded={hasChats ? visiblyExpanded : undefined}
              aria-controls={hasChats ? contentId : undefined}
              onClick={(event) => {
                event.stopPropagation();
                if (hasChats && !forceExpanded) setExpanded((current) => !current);
              }}
            >
              {visiblyExpanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
            </ActionIcon>
          </span>
        </Tooltip>
        <Tooltip label="New chat in this folder">
          <ActionIcon
            size="sm" variant="subtle" color="gray"
            style={{ flexShrink: 0 }}
            aria-label={`New chat in ${name}`}
            onClick={(event) => { event.stopPropagation(); setExpanded(true); onNewChat(); }}
          ><IconMessagePlus size={16} /></ActionIcon>
        </Tooltip>
        <Menu position="bottom-end" withinPortal shadow="md">
          <Menu.Target>
            <ActionIcon size="sm" variant="subtle" color="gray" aria-label={`More options for ${name}`}
              style={{ flexShrink: 0 }}>
              <IconDotsVertical size={16} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown onClick={(event) => event.stopPropagation()}>
            <Menu.Item leftSection={<IconEdit size={16} />} onClick={onRename}>Rename folder</Menu.Item>
            <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={onDelete}>Delete folder</Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
      <Collapse expanded={visiblyExpanded} keepMounted style={{ width: "100%", minWidth: 0, maxWidth: "100%", overflow: "hidden" }}>
        <Stack id={contentId} gap={2} mt={6} style={{ width: "100%", minWidth: 0, maxWidth: "100%", overflow: "hidden" }}>
          {children}
        </Stack>
      </Collapse>
    </Box>
  );
}
