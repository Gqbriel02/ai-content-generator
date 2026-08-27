"use client";
/* eslint-disable @next/next/no-img-element */

import { Badge, Box, Group, Loader, Stack, Text, ThemeIcon } from "@mantine/core";
import { IconPhotoOff } from "@tabler/icons-react";
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";
import { useMemo, useState } from "react";
import { getAnswerModeLabel, type AnswerMode } from "@/lib/ai/answer-modes";
import { GeneratedImageViewer } from "@/components/chat/generated-image-viewer";

export type DisplayMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content_text: string;
  answer_mode?: AnswerMode | null;
  attachments?: { id?: string; signedUrl: string | null; mimeType: string; storagePath: string; availability?: "available" | "unavailable" }[];
  generation_type?: "text" | "image";
  image_alt?: string;
};

type Props = {
  message: DisplayMessage;
  pendingStatus?: "loading" | "error" | "canceled";
  pendingErrorMessage?: string;
  onReuseGeneratedImage?: (attachment: { attachmentId: string; previewUrl: string; mimeType: string }) => void;
};

function MarkdownView({ value }: { value: string }) {
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(value, { breaks: true }) as string), [value]);
  return <Box dangerouslySetInnerHTML={{ __html: html }} />;
}

export function UnavailableImage({ compact = false }: { compact?: boolean }) {
  return <Stack align="center" justify="center" gap={4} p={compact ? "sm" : "xl"} role="img" aria-label="Image unavailable"
    style={{ width: compact ? 150 : "min(100%, 520px)", minHeight: compact ? 100 : 180,
      border: "1px dashed var(--mantine-color-gray-4)", borderRadius: 8, background: "var(--mantine-color-gray-1)" }}>
    <ThemeIcon variant="light" color="gray"><IconPhotoOff size={18} /></ThemeIcon>
    <Text size="sm" fw={600}>Image unavailable</Text>
    <Text size="xs" c="dimmed" ta="center">The file may have been deleted or corrupted.</Text>
  </Stack>;
}

export function MessageCard({ message, pendingStatus, pendingErrorMessage, onReuseGeneratedImage }: Props) {
  const [failedAttachments, setFailedAttachments] = useState<Set<string>>(() => new Set());
  const isImageGeneration = message.generation_type === "image" ||
    (message.role === "assistant" && !message.content_text && Boolean(message.attachments?.length));
  const isGeneratedAssistantImage = message.role === "assistant" && isImageGeneration;
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
        {message.role === "assistant" && isImageGeneration ? (
          <Badge variant="light" color="violet" radius="xl" size="sm">IMAGE</Badge>
        ) : message.role === "assistant" && getAnswerModeLabel(message.answer_mode) ? (
          <Badge variant="light" color="gray" radius="xl" size="sm">
            {getAnswerModeLabel(message.answer_mode)}
          </Badge>
        ) : null}
      </Group>
      {pendingStatus === "loading" ? (
        <Group gap="sm" role="status" aria-live="polite">
          <Loader size="sm" />
          <Text c="dimmed">{isImageGeneration ? "Generating image..." : "Loading..."}</Text>
        </Group>
      ) : pendingStatus === "error" ? (
        <Text c="red">{pendingErrorMessage ?? (isImageGeneration ? "Image generation failed." : "Generation failed. Please try again.")}</Text>
      ) : pendingStatus === "canceled" ? (
        <Text c="dimmed">The request was canceled.</Text>
      ) : (
        <MarkdownView value={message.content_text || ""} />
      )}
      {message.attachments?.length ? (
        <Group mt="sm" justify={isGeneratedAssistantImage ? "center" : undefined} style={{ maxWidth: "100%" }}>
          {message.attachments.map((attachment) => (
            attachment.availability === "unavailable" || !attachment.signedUrl || failedAttachments.has(attachment.id ?? attachment.storagePath) ? (
              <UnavailableImage key={attachment.id ?? attachment.storagePath} compact={!isGeneratedAssistantImage} />
            ) : isGeneratedAssistantImage && attachment.id ? (
              <GeneratedImageViewer
                key={attachment.storagePath}
                attachmentId={attachment.id}
                signedUrl={attachment.signedUrl}
                alt={message.image_alt ?? "Generated image"}
                inlineStyle={{ width: "auto", height: "auto", maxWidth: "min(100%, 520px)", maxHeight: 320, borderRadius: 8, objectFit: "contain" }}
                onReuse={onReuseGeneratedImage ? () => onReuseGeneratedImage({ attachmentId: attachment.id!, previewUrl: attachment.signedUrl!, mimeType: attachment.mimeType }) : undefined}
                onUnavailable={() => setFailedAttachments((current) => new Set(current).add(attachment.id!))}
              />
            ) : (
              <img key={attachment.storagePath} src={attachment.signedUrl} alt={message.image_alt ?? (message.role === "user" ? "Attachment" : "Generated image")}
                onError={() => setFailedAttachments((current) => new Set(current).add(attachment.id ?? attachment.storagePath))}
                style={isGeneratedAssistantImage
                  ? { width: "auto", height: "auto", maxWidth: "min(100%, 520px)", maxHeight: 320, borderRadius: 8, objectFit: "contain" }
                  : { width: 150, height: "auto", borderRadius: 8, objectFit: "contain", maxWidth: "100%" }} />
            )
          ))}
        </Group>
      ) : null}
    </Box>
  );
}
