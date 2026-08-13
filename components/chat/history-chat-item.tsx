"use client";

import Link from "next/link";
import { ActionIcon, Group, Menu, NavLink, Text, Tooltip } from "@mantine/core";
import { IconDotsVertical, IconEdit, IconGripVertical, IconFolderSymlink, IconTrash } from "@tabler/icons-react";
import { useDraggable } from "@dnd-kit/core";

type HistoryChatItemProps = {
  id: string;
  title: string;
  href: string;
  active: boolean;
  onSelect: () => void;
  onRename: () => void;
  onMove?: () => void;
  onDelete: () => void;
  folderId?: string | null;
  moving?: boolean;
};

export function HistoryChatItem({ id, title, href, active, onSelect, onRename, onMove = () => {}, onDelete, folderId = null, moving = false }: HistoryChatItemProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `chat:${id}`,
    data: { chatId: id, title, folderId },
    disabled: moving,
  });
  return (
    <Group ref={setNodeRef} gap={0} wrap="nowrap" data-chat-id={id}
      style={{ width: "100%", minWidth: 0, maxWidth: "100%", overflow: "hidden", opacity: isDragging || moving ? 0.5 : 1 }}>
      <Tooltip label="Drag to move" disabled={isDragging}>
        <ActionIcon aria-label={`Drag ${title}`} size="sm" variant="subtle" color="gray"
          {...attributes} {...listeners} onClick={(event) => event.preventDefault()} style={{ flexShrink: 0 }}>
          <IconGripVertical size={14} />
        </ActionIcon>
      </Tooltip>
      <NavLink
        component={Link}
        href={href}
        active={active}
        onClick={onSelect}
        label={(
          <Tooltip label={title} multiline maw={360} withinPortal>
            <Text
              size="sm"
              truncate
              data-chat-title={title}
              data-tooltip-label={title}
              style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {title}
            </Text>
          </Tooltip>
        )}
        style={{ flex: "1 1 0", minWidth: 0, maxWidth: "100%", overflow: "hidden" }}
      />
      <Menu position="bottom-end" withinPortal shadow="md">
        <Menu.Target>
          <ActionIcon
            aria-label="More options"
            title="More options"
            size="sm"
            variant="subtle"
            color="gray"
            style={{ flexShrink: 0 }}
          >
            <IconDotsVertical size={16} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown onClick={(event) => event.stopPropagation()}>
          <Menu.Item
            leftSection={<IconEdit size={16} />}
            onClick={(event) => { event.stopPropagation(); onRename(); }}
          >
            Rename chat
          </Menu.Item>
          <Menu.Item leftSection={<IconFolderSymlink size={16} />}
            onClick={(event) => { event.stopPropagation(); onMove(); }}>
            Move to folder
          </Menu.Item>
          <Menu.Divider />
          <Menu.Item
            color="red"
            leftSection={<IconTrash size={16} />}
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
          >
            Delete chat
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Group>
  );
}
