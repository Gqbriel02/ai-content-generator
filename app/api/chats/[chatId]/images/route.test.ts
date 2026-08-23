import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(), findChatById: vi.fn(), findSameChatGeneratedAttachments: vi.fn(),
  persistImageChatExchange: vi.fn(), findAttachmentByMessage: vi.fn(), hitRateLimit: vi.fn(),
  persistUploadedImages: vi.fn(), loadStoredImageReference: vi.fn(), generateAndStoreImage: vi.fn(),
  createSignedReadUrl: vi.fn(), deleteAttachmentObjects: vi.fn(),
}));
vi.mock("@/lib/auth/require-session", () => ({ requireSession: mocks.requireSession }));
vi.mock("@/lib/db/chat-repo", () => ({ findChatById: mocks.findChatById,
  findSameChatGeneratedAttachments: mocks.findSameChatGeneratedAttachments,
  persistImageChatExchange: mocks.persistImageChatExchange, findAttachmentByMessage: mocks.findAttachmentByMessage }));
vi.mock("@/lib/http/rate-limit", () => ({ hitRateLimit: mocks.hitRateLimit }));
vi.mock("@/lib/storage/uploaded-images", () => ({ persistUploadedImages: mocks.persistUploadedImages, validatePendingImages: vi.fn(async () => []) }));
vi.mock("@/lib/ai/image-service", () => ({ generateAndStoreImage: mocks.generateAndStoreImage }));
vi.mock("@/lib/storage/attachments", () => ({ GeneratedImageStorageError: class GeneratedImageStorageError extends Error {},
  loadStoredImageReference: mocks.loadStoredImageReference, createSignedReadUrl: mocks.createSignedReadUrl,
  deleteAttachmentObjects: mocks.deleteAttachmentObjects }));

import { POST } from "./route";

const chatId = "00000000-0000-4000-8000-000000000002";
const referenceId = "00000000-0000-4000-8000-000000000011";
const existing = { id: referenceId, storagePath: `00000000-0000-4000-8000-000000000001/${chatId}/generated/old.webp`, mimeType: "image/webp", sizeBytes: 3 };
const generated = { storagePath: `00000000-0000-4000-8000-000000000001/${chatId}/generated/new.webp`, mimeType: "image/webp", sizeBytes: 4, width: 1024, height: 1024 };

function request(withReference = true) {
  const form = new FormData(); form.set("content", "Make it greener"); form.set("aspectRatio", "1:1");
  if (withReference) form.append("referenceAttachmentIds", referenceId);
  return new Request("http://local", { method: "POST", body: form });
}

describe("POST /api/chats/[chatId]/images reuse", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.requireSession.mockResolvedValue({ session: { profileId: "00000000-0000-4000-8000-000000000001" } });
    mocks.findChatById.mockResolvedValue({ id: chatId }); mocks.hitRateLimit.mockReturnValue(false);
    mocks.findSameChatGeneratedAttachments.mockResolvedValue([existing]);
    mocks.loadStoredImageReference.mockResolvedValue({ bytes: Uint8Array.from([1, 2, 3]).buffer, mimeType: "image/webp", sizeBytes: 3, originalName: "old.webp" });
    mocks.persistUploadedImages.mockResolvedValue([]); mocks.generateAndStoreImage.mockResolvedValue(generated);
    mocks.persistImageChatExchange.mockResolvedValue({ userMessage: { id: "user" }, assistantMessage: { id: "assistant" } });
    mocks.findAttachmentByMessage.mockResolvedValue({ id: "new-attachment" });
    mocks.createSignedReadUrl.mockImplementation(async (path: string) => `signed:${path}`);
    mocks.deleteAttachmentObjects.mockResolvedValue(undefined);
  });

  it("uses the private object, creates no duplicate upload, and persists its shared path", async () => {
    const response = await POST(request(), { params: Promise.resolve({ chatId }) });
    expect(response!.status).toBe(200);
    expect(mocks.loadStoredImageReference).toHaveBeenCalledWith(existing.storagePath, "image/webp");
    expect(mocks.persistUploadedImages).toHaveBeenCalledWith(expect.objectContaining({ images: [] }));
    expect(mocks.generateAndStoreImage).toHaveBeenCalledWith(expect.objectContaining({
      prompt: "Make it greener", sourceImages: [expect.objectContaining({ originalName: "old.webp" })],
    }));
    expect(mocks.persistImageChatExchange).toHaveBeenCalledWith(expect.objectContaining({
      userAttachments: [expect.objectContaining({ storagePath: existing.storagePath })], attachment: generated,
    }));
  });

  it("treats missing, other-user, and other-chat references as not found", async () => {
    mocks.findSameChatGeneratedAttachments.mockResolvedValue(null);
    const response = await POST(request(), { params: Promise.resolve({ chatId }) });
    expect(response!.status).toBe(404);
    expect(mocks.generateAndStoreImage).not.toHaveBeenCalled();
  });

  it("does not add prior image context when no reference was explicit", async () => {
    mocks.findSameChatGeneratedAttachments.mockResolvedValue([]);
    await POST(request(false), { params: Promise.resolve({ chatId }) });
    expect(mocks.findSameChatGeneratedAttachments).toHaveBeenCalledWith(expect.any(String), chatId, []);
    expect(mocks.generateAndStoreImage).toHaveBeenCalledWith(expect.objectContaining({ sourceImages: [] }));
  });

  it("preserves the existing source and writes no exchange when generation fails", async () => {
    mocks.generateAndStoreImage.mockRejectedValue(new Error("provider failed"));
    const response = await POST(request(), { params: Promise.resolve({ chatId }) });
    expect(response!.status).toBe(500);
    expect(mocks.persistImageChatExchange).not.toHaveBeenCalled();
    expect(mocks.deleteAttachmentObjects).toHaveBeenCalledWith([]);
  });

  it("cleans only the new generated output when database persistence fails", async () => {
    mocks.persistImageChatExchange.mockRejectedValue(new Error("database failed"));
    const response = await POST(request(), { params: Promise.resolve({ chatId }) });
    expect(response!.status).toBe(500);
    expect(mocks.deleteAttachmentObjects).toHaveBeenCalledWith([generated.storagePath]);
    expect(mocks.deleteAttachmentObjects).not.toHaveBeenCalledWith(expect.arrayContaining([existing.storagePath]));
  });
});
