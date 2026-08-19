import type { PendingImage } from "@/lib/storage/uploaded-images";

export type PreparedLmStudioImage = { bytes: Uint8Array; mimeType: "image/jpeg" | "image/png" | "image/gif" };
type WebpToPng = (bytes: ArrayBuffer) => Promise<Uint8Array>;

export class LmStudioImagePreparationError extends Error {
  constructor() {
    super("The WebP attachment could not be prepared for the AI model.");
    this.name = "LmStudioImagePreparationError";
  }
}

async function convertWebpToPng(bytes: ArrayBuffer) {
  const { default: sharp } = await import("sharp");
  return new Uint8Array(await sharp(Buffer.from(bytes)).png().toBuffer());
}

export async function prepareImageForLmStudio(
  image: Pick<PendingImage, "bytes" | "mimeType">,
  webpToPng: WebpToPng = convertWebpToPng,
): Promise<PreparedLmStudioImage> {
  if (image.mimeType !== "image/webp") {
    return { bytes: new Uint8Array(image.bytes), mimeType: image.mimeType as PreparedLmStudioImage["mimeType"] };
  }

  try {
    const bytes = await webpToPng(image.bytes);
    console.info("LM Studio image preparation completed.", {
      mime: "image/webp",
      conversion: "webp-to-png",
      originalBytes: image.bytes.byteLength,
      convertedBytes: bytes.byteLength,
    });
    return { bytes, mimeType: "image/png" };
  } catch {
    throw new LmStudioImagePreparationError();
  }
}

export async function createLmStudioImageDataUrl(image: Pick<PendingImage, "bytes" | "mimeType">) {
  const prepared = await prepareImageForLmStudio(image);
  return {
    dataUrl: `data:${prepared.mimeType};base64,${Buffer.from(prepared.bytes).toString("base64")}`,
    mimeType: prepared.mimeType,
  };
}
