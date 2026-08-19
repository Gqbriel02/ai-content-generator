import { beforeEach, describe, expect, it, vi } from "vitest";

const uploadChatMedia = vi.hoisted(() => vi.fn());
vi.mock("@/lib/storage/chat-media", () => ({ uploadChatMedia }));
import { persistUploadedImages } from "./uploaded-images";

describe("persistUploadedImages", () => {
  beforeEach(() => uploadChatMedia.mockReset());

  it("persists the original WebP bytes and metadata, not LM Studio's temporary PNG", async () => {
    uploadChatMedia.mockResolvedValue("profile/chat/uploaded/id.webp");
    const bytes = Uint8Array.from([82, 73, 70, 70, 1, 2, 3]).buffer;
    const result = await persistUploadedImages({
      profileId: "profile",
      chatId: "chat",
      images: [{ bytes, mimeType: "image/webp", sizeBytes: bytes.byteLength, originalName: "photo.webp" }],
    });
    expect(uploadChatMedia).toHaveBeenCalledWith(expect.objectContaining({ kind: "uploaded", mimeType: "image/webp", bytes }));
    expect(result).toEqual([{ storagePath: "profile/chat/uploaded/id.webp", mimeType: "image/webp", sizeBytes: bytes.byteLength }]);
  });
});
