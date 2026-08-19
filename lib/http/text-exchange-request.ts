import type { AnswerMode } from "@/lib/ai/answer-modes";
import { createInitialExchangeSchema, createMessageSchema } from "@/lib/validation/chat";
import { validatePendingImages } from "@/lib/storage/uploaded-images";

export function parseTextExchangeRequest(request: Request, initial: true): Promise<ReturnType<typeof createInitialExchangeSchema.parse> & { files: Awaited<ReturnType<typeof validatePendingImages>> }>;
export function parseTextExchangeRequest(request: Request, initial: false): Promise<ReturnType<typeof createMessageSchema.parse> & { files: Awaited<ReturnType<typeof validatePendingImages>> }>;
export async function parseTextExchangeRequest(request: Request, initial: boolean) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    const body = await request.json();
    const parsed = (initial ? createInitialExchangeSchema : createMessageSchema).safeParse(body);
    if (!parsed.success) throw new Error("INVALID_REQUEST");
    if (parsed.data.attachments.length) throw new Error("LEGACY_ATTACHMENTS_NOT_SUPPORTED");
    return { ...parsed.data, files: [] };
  }
  const form = await request.formData();
  const raw = {
    content: form.get("content"),
    answerMode: form.get("answerMode") as AnswerMode,
    attachments: [],
    ...(initial ? { folderId: form.get("folderId") || null } : {}),
  };
  const parsed = (initial ? createInitialExchangeSchema : createMessageSchema).safeParse(raw);
  if (!parsed.success) throw new Error("INVALID_REQUEST");
  const fileValues = form.getAll("files");
  if (fileValues.some((value) => !(value instanceof File))) throw new Error("INVALID_REQUEST");
  return { ...parsed.data, files: await validatePendingImages(fileValues as File[]) };
}
