import { z } from "zod";

export const createFolderSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export const updateFolderSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  position: z.number().int().nonnegative().optional(),
});

export const createChatSchema = z.object({
  title: z.string().trim().min(1).max(120),
  folderId: z.string().uuid().nullable().optional(),
  systemPrompt: z.string().max(4000).optional(),
});

export const updateChatSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  folderId: z.string().uuid().nullable().optional(),
  systemPrompt: z.string().max(4000).optional(),
});

export const HISTORY_SEARCH_MAX_LENGTH = 200;

export const historyQuerySchema = z.object({
  q: z.string().trim().max(HISTORY_SEARCH_MAX_LENGTH).default(""),
  sort: z.enum(["newest", "oldest"]).default("newest"),
});

export const ratingSchema = z.object({
  rating: z.union([z.literal(1), z.literal(-1), z.null()]),
}).strict();

export const attachmentInputSchema = z.object({
  storagePath: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export const createMessageSchema = z.object({
  content: z.string().trim().min(1).max(12000),
  mode: z.enum(["chat", "task"]).default("chat"),
  attachments: z.array(attachmentInputSchema).max(8).default([]),
});

export const submitTaskAnswerSchema = z.object({
  values: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
});
