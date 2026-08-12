"use client";

import { ActionIcon, Box, Collapse, Group, Menu, Stack, Text, Tooltip } from "@mantine/core";
import { IconChevronDown, IconChevronUp, IconDotsVertical, IconEdit, IconMessagePlus, IconTrash } from "@tabler/icons-react";
import { Children, useId, useState, type ReactNode } from "react";

type Props = {
  name: string;
  children: ReactNode;
  onNewChat: () => void;
  onRename: () => void;
  onDelete: () => void;
};

export function HistoryFolderItem({ name, children, onNewChat, onRename, onDelete }: Props) {
  const [expanded, setExpanded] = useState(true);
  const contentId = useId();
  const hasChats = Children.count(children) > 0;

  return (
    <Box p={8} style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 8 }}>
      <Group gap={4} wrap="nowrap">
        <Text size="sm" truncate style={{ flex: 1, minWidth: 0 }}>{name}</Text>
        <Tooltip label={hasChats ? (expanded ? "Collapse folder" : "Expand folder") : "No chats in this folder"}>
          <span
            title={hasChats ? undefined : "No chats in this folder"}
            style={{ display: "inline-flex", cursor: hasChats ? undefined : "not-allowed" }}
          >
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              disabled={!hasChats}
              aria-label={hasChats ? `${expanded ? "Collapse" : "Expand"} ${name}` : `No chats in ${name}`}
              aria-expanded={hasChats ? expanded : undefined}
              aria-controls={hasChats ? contentId : undefined}
              onClick={(event) => {
                event.stopPropagation();
                if (hasChats) setExpanded((current) => !current);
              }}
            >
              {expanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
            </ActionIcon>
          </span>
        </Tooltip>
        <Tooltip label="New chat in this folder">
          <ActionIcon
            size="sm" variant="subtle" color="gray"
            aria-label={`New chat in ${name}`}
            onClick={(event) => { event.stopPropagation(); setExpanded(true); onNewChat(); }}
          ><IconMessagePlus size={16} /></ActionIcon>
        </Tooltip>
        <Menu position="bottom-end" withinPortal shadow="md">
          <Menu.Target>
            <ActionIcon size="sm" variant="subtle" color="gray" aria-label={`More options for ${name}`}>
              <IconDotsVertical size={16} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown onClick={(event) => event.stopPropagation()}>
            <Menu.Item leftSection={<IconEdit size={16} />} onClick={onRename}>Rename folder</Menu.Item>
            <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={onDelete}>Delete folder</Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
      <Collapse expanded={expanded} keepMounted>
        <Stack id={contentId} gap={2} mt={6}>{children}</Stack>
      </Collapse>
    </Box>
  );
}
