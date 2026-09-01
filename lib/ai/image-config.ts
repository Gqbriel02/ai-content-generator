export const IMAGE_MODEL_ID = "flux-2-klein-4b";

export const IMAGE_ASPECT_RATIOS = {
  "1:1": { width: 1024, height: 1024 },
  "16:9": { width: 1344, height: 768 },
  "9:16": { width: 768, height: 1344 },
} as const;

export type ImageAspectRatio = keyof typeof IMAGE_ASPECT_RATIOS;
