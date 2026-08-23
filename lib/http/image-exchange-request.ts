import { createImageSchema, createInitialImageSchema } from "@/lib/validation/chat";
import { validatePendingImages } from "@/lib/storage/uploaded-images";
import { z } from "zod";

const MAX_IMAGE_REFERENCES = 4;

type ParsedFiles = { files: Awaited<ReturnType<typeof validatePendingImages>>; referenceAttachmentIds: string[] };
export function parseImageExchangeRequest(request: Request, initial: true): Promise<ReturnType<typeof createInitialImageSchema.parse> & ParsedFiles>;
export function parseImageExchangeRequest(request: Request, initial: false): Promise<ReturnType<typeof createImageSchema.parse> & ParsedFiles>;
export async function parseImageExchangeRequest(request: Request, initial: boolean) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    const parsed = (initial ? createInitialImageSchema : createImageSchema).safeParse(await request.json());
    if (!parsed.success) throw new Error("INVALID_REQUEST");
    return { ...parsed.data, files: [], referenceAttachmentIds: [] };
  }

  const form = await request.formData();
  const parsed = (initial ? createInitialImageSchema : createImageSchema).safeParse({
    content: form.get("content"),
    aspectRatio: form.get("aspectRatio"),
    ...(initial ? { folderId: form.get("folderId") || null } : {}),
  });
  if (!parsed.success) throw new Error("INVALID_REQUEST");
  const values = form.getAll("files");
  const referenceValues = form.getAll("referenceAttachmentIds");
  const references = z.array(z.string().uuid()).max(MAX_IMAGE_REFERENCES).safeParse(referenceValues);
  if (!references.success || (initial && references.data.length) || values.length + references.data.length > MAX_IMAGE_REFERENCES ||
      values.some((value) => !(value instanceof File))) {
    throw new Error("INVALID_REQUEST");
  }
  return { ...parsed.data, files: await validatePendingImages(values as File[]), referenceAttachmentIds: references.data };
}
