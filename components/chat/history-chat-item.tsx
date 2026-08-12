"use client";

import Link from "next/link";
import { ActionIcon, Group, Menu, NavLink, Text, Tooltip } from "@mantine/core";
import { IconDotsVertical, IconEdit, IconTrash } from "@tabler/icons-react";

type HistoryChatItemProps = {
  id: string;
  title: string;
  href: string;
  active: boolean;
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
};

export function HistoryChatItem({ title, href, active, onSelect, onRename, onDelete }: HistoryChatItemProps) {
  return (
    <Group gap={0} wrap="nowrap" style={{ minWidth: 0 }}>
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
        style={{ flex: 1, minWidth: 0 }}
      />
      <Menu position="bottom-end" withinPortal shadow="md">
        <Menu.Target>
          <ActionIcon
            aria-label="More options"
            title="More options"
            size="sm"
            variant="subtle"
            color="gray"
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
