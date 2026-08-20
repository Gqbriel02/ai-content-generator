"use client";
/* eslint-disable @next/next/no-img-element */

import { Button, Group, Modal, UnstyledButton } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconDownload } from "@tabler/icons-react";
import { useState } from "react";

type Props = {
  attachmentId: string;
  signedUrl: string;
  alt: string;
  inlineStyle: React.CSSProperties;
};

function downloadFilename(response: Response) {
  const disposition = response.headers.get("content-disposition") ?? "";
  return disposition.match(/filename="([^"\\/]+)"/i)?.[1] ?? "generated-image.webp";
}

export function GeneratedImageViewer({ attachmentId, signedUrl, alt, inlineStyle }: Props) {
  const [opened, setOpened] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function downloadImage() {
    if (downloading) return;
    setDownloading(true);
    let objectUrl: string | undefined;
    try {
      const response = await fetch(`/api/attachments/${encodeURIComponent(attachmentId)}/download`);
      if (!response.ok) throw new Error("Download failed");
      objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = downloadFilename(response);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      notifications.show({ color: "red", title: "Download failed", message: "Could not download the image." });
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setDownloading(false);
    }
  }

  return (
    <>
      <UnstyledButton
        aria-label="View generated image"
        onClick={() => setOpened(true)}
        style={{ display: "flex", cursor: "zoom-in", maxWidth: "100%", borderRadius: 8 }}
      >
        <img src={signedUrl} alt={alt} style={inlineStyle} />
      </UnstyledButton>
      <Modal.Root opened={opened} onClose={() => setOpened(false)} size="90vw" centered transitionProps={{ duration: 0 }}>
        <Modal.Overlay backgroundOpacity={0.72} blur={2} />
        <Modal.Content>
          <Modal.Header>
            <Modal.Title style={{ minWidth: 0 }}>Generated image</Modal.Title>
            <Group gap="xs" wrap="nowrap">
              <Button size="sm" leftSection={<IconDownload size={18} />} loading={downloading} onClick={downloadImage}>
                Download
              </Button>
              <Modal.CloseButton aria-label="Close image viewer" />
            </Group>
          </Modal.Header>
          <Modal.Body>
            <Group justify="center" style={{ minHeight: 0 }}>
              <img
                src={signedUrl}
                alt={alt}
                style={{ width: "auto", height: "auto", maxWidth: "90vw", maxHeight: "70vh", objectFit: "contain", borderRadius: 8 }}
              />
            </Group>
          </Modal.Body>
        </Modal.Content>
      </Modal.Root>
    </>
  );
}
