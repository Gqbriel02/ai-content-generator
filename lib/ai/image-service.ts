import { generateImage } from "@/lib/ai/bfl";
import { downloadAndStoreGeneratedImage } from "@/lib/storage/attachments";
import type { PendingImage } from "@/lib/storage/uploaded-images";

export async function generateAndStoreImage(input: { prompt: string; profileId: string; chatId: string; width: number; height: number; sourceImages?: PendingImage[]; imageRequestId?: string }) {
  const generated = await generateImage({ ...input,
    inputImages: input.sourceImages?.map((image) => Buffer.from(image.bytes).toString("base64")),
  }, { imageRequestId: input.imageRequestId });
  return downloadAndStoreGeneratedImage({ temporaryUrl: generated.temporaryUrl, profileId: input.profileId, chatId: input.chatId, width: input.width, height: input.height, imageRequestId: input.imageRequestId });
}
