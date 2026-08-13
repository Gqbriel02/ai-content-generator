"use client";

import { Box } from "@mantine/core";
import { useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";

export function NoFolderDropZone({ children }: { children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "folder:no-folder", data: { folderId: null } });
  return (
    <Box ref={setNodeRef} data-folder-drop-id="no-folder" style={{
      minHeight: 42,
      flex: 1,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      borderRadius: 8,
      outline: isOver ? "1px solid var(--mantine-color-blue-5)" : undefined,
      background: isOver ? "var(--mantine-color-blue-0)" : undefined,
    }}>
      {children}
    </Box>
  );
}
