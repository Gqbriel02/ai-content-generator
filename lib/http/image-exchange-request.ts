import { createImageSchema, createInitialImageSchema } from "@/lib/validation/chat";
import { validatePendingImages } from "@/lib/storage/uploaded-images";

const MAX_IMAGE_REFERENCES = 4;

export function parseImageExchangeRequest(request: Request, initial: true): Promise<ReturnType<typeof createInitialImageSchema.parse> & { files: Awaited<ReturnType<typeof validatePendingImages>> }>;
export function parseImageExchangeRequest(request: Request, initial: false): Promise<ReturnType<typeof createImageSchema.parse> & { files: Awaited<ReturnType<typeof validatePendingImages>> }>;
export async function parseImageExchangeRequest(request: Request, initial: boolean) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    const parsed = (initial ? createInitialImageSchema : createImageSchema).safeParse(await request.json());
    if (!parsed.success) throw new Error("INVALID_REQUEST");
    return { ...parsed.data, files: [] };
  }

  const form = await request.formData();
  const parsed = (initial ? createInitialImageSchema : createImageSchema).safeParse({
    content: form.get("content"),
    aspectRatio: form.get("aspectRatio"),
    ...(initial ? { folderId: form.get("folderId") || null } : {}),
  });
  if (!parsed.success) throw new Error("INVALID_REQUEST");
  const values = form.getAll("files");
  if (values.length > MAX_IMAGE_REFERENCES || values.some((value) => !(value instanceof File))) {
    throw new Error("INVALID_REQUEST");
  }
  return { ...parsed.data, files: await validatePendingImages(values as File[]) };
}
