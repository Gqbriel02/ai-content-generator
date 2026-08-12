export type Role = "system" | "user" | "assistant" | "tool";

export type AttachmentInput = {
  storagePath: string;
  mimeType: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
};
