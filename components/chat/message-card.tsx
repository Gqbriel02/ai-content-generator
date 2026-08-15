"use client";
/* eslint-disable @next/next/no-img-element */

import { Badge, Box, Group, Loader, Text } from "@mantine/core";
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";
import { useMemo } from "react";
import { getAnswerModeLabel, type AnswerMode } from "@/lib/ai/answer-modes";

export type DisplayMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content_text: string;
  answer_mode?: AnswerMode | null;
  attachments?: { signedUrl: string; mimeType: string; storagePath: string }[];
};

type Props = {
  message: DisplayMessage;
  pendingStatus?: "loading" | "error";
};

function MarkdownView({ value }: { value: string }) {
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(value, { breaks: true }) as string), [value]);
  return <Box dangerouslySetInnerHTML={{ __html: html }} />;
}

export function MessageCard({ message, pendingStatus }: Props) {
  return (
    <Box
      p="md"
      data-message-role={message.role}
      data-pending-status={pendingStatus}
      style={{
        borderRadius: 12,
        border: "1px solid var(--mantine-color-gray-3)",
        background: message.role === "user" ? "var(--mantine-color-blue-0)" : "var(--mantine-color-gray-0)",
      }}
    >
      <Group justify="space-between" mb={8}>
        <Badge variant="light">{message.role}</Badge>
        {message.role === "assistant" && getAnswerModeLabel(message.answer_mode) ? (
          <Badge variant="light" color="gray" radius="xl" size="sm">
            {getAnswerModeLabel(message.answer_mode)}
          </Badge>
        ) : null}
      </Group>
      {pendingStatus === "loading" ? (
        <Group gap="sm" role="status" aria-live="polite">
          <Loader size="sm" />
          <Text c="dimmed">Loading...</Text>
        </Group>
      ) : pendingStatus === "error" ? (
        <Text c="red">Generation failed. Please try again.</Text>
      ) : (
        <MarkdownView value={message.content_text || ""} />
      )}
      {message.attachments?.length ? (
        <Group mt="sm">
          {message.attachments.map((attachment) => (
            <img key={attachment.storagePath} src={attachment.signedUrl} alt="Attachment"
              style={{ width: 150, borderRadius: 8 }} />
          ))}
        </Group>
      ) : null}
    </Box>
  );
}
