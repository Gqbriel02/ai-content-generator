"use client";

import Link from "next/link";
import { ActionIcon, Group, Menu, NavLink, Text } from "@mantine/core";
import { IconDotsVertical, IconTrash } from "@tabler/icons-react";

type HistoryChatItemProps = {
  id: string;
  title: string;
  href: string;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
};

export function HistoryChatItem({ title, href, active, onSelect, onDelete }: HistoryChatItemProps) {
  return (
    <Group gap={0} wrap="nowrap" style={{ minWidth: 0 }}>
      <NavLink
        component={Link}
        href={href}
        active={active}
        onClick={onSelect}
        label={<Text size="sm" truncate>{title}</Text>}
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
