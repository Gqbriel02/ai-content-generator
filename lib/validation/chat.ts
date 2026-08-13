import { z } from "zod";
import { DEFAULT_ANSWER_MODE, isAnswerMode } from "../ai/answer-modes";

export const FOLDER_NAME_MAX_LENGTH = 80;
export const CHAT_TITLE_MAX_LENGTH = 120;

export const createFolderSchema = z.object({
  name: z.string().trim().min(1).max(FOLDER_NAME_MAX_LENGTH),
});

export const updateFolderSchema = z.object({
  name: z.string().trim().min(1).max(FOLDER_NAME_MAX_LENGTH),
}).strict();

export const createChatSchema = z.object({
  title: z.string().trim().min(1).max(CHAT_TITLE_MAX_LENGTH),
  folderId: z.string().uuid().nullable().optional(),
}).strict();

export const updateChatSchema = z.union([
  z.object({
    title: z.string().trim().min(1).max(CHAT_TITLE_MAX_LENGTH),
  }).strict(),
  z.object({
    folderId: z.string().uuid().nullable(),
  }).strict(),
]);

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
  answerMode: z.preprocess(
    (value) => (isAnswerMode(value) ? value : DEFAULT_ANSWER_MODE),
    z.enum(["standard", "concise", "detailed", "creative", "code", "tutorial"]),
  ),
  attachments: z.array(attachmentInputSchema).max(8).default([]),
}).strict();

export const createInitialExchangeSchema = createMessageSchema.extend({
  folderId: z.string().uuid().nullable().default(null),
}).strict();
