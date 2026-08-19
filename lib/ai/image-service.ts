import { generateImage } from "@/lib/ai/bfl";
import { downloadAndStoreGeneratedImage } from "@/lib/storage/attachments";

export async function generateAndStoreImage(input: { prompt: string; profileId: string; width: number; height: number; imageRequestId?: string }) {
  const generated = await generateImage(input, { imageRequestId: input.imageRequestId });
  return downloadAndStoreGeneratedImage({ temporaryUrl: generated.temporaryUrl, profileId: input.profileId, width: input.width, height: input.height, imageRequestId: input.imageRequestId });
}
