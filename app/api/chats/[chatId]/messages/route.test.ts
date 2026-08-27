import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(), findChatById: vi.fn(), getChatById: vi.fn(), listMessages: vi.fn(),
  persistChatExchange: vi.fn(), hitRateLimit: vi.fn(), generateAssistantReply: vi.fn(),
  isLmStudioRequestCanceled: vi.fn(), persistUploadedImages: vi.fn(),
  createSignedReadUrl: vi.fn(), isStorageObjectMissing: vi.fn(),
}));
vi.mock("@/lib/auth/require-session", () => ({ requireSession: mocks.requireSession }));
vi.mock("@/lib/db/chat-repo", () => ({ findChatById: mocks.findChatById, getChatById: mocks.getChatById,
  listMessages: mocks.listMessages, persistChatExchange: mocks.persistChatExchange }));
vi.mock("@/lib/http/rate-limit", () => ({ hitRateLimit: mocks.hitRateLimit }));
vi.mock("@/lib/storage/attachments", () => ({ createSignedReadUrl: mocks.createSignedReadUrl, deleteAttachmentObjects: vi.fn(),
  isStorageObjectMissing: mocks.isStorageObjectMissing }));
vi.mock("@/lib/storage/uploaded-images", () => ({ persistUploadedImages: mocks.persistUploadedImages, validatePendingImages: vi.fn() }));
vi.mock("@/lib/ai/lmstudio", () => ({ generateAssistantReply: mocks.generateAssistantReply,
  isLmStudioRequestCanceled: mocks.isLmStudioRequestCanceled, LmStudioError: class extends Error {} }));

import { GET, POST } from "./route";

describe("POST /api/chats/[chatId]/messages cancellation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSession.mockResolvedValue({ session: { profileId: "profile-id" } });
    mocks.findChatById.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111" });
    mocks.listMessages.mockResolvedValue([{ role: "assistant", content_text: "Existing response" }]);
    mocks.hitRateLimit.mockReturnValue(false);
    mocks.isLmStudioRequestCanceled.mockImplementation((_error, signal) => signal?.aborted === true);
    mocks.isStorageObjectMissing.mockImplementation((error) => error?.statusCode === 404);
  });

  it("passes the incoming signal and leaves the existing chat unmodified when canceled", async () => {
    const controller = new AbortController();
    mocks.generateAssistantReply.mockImplementation(async (_messages, _mode, signal) => {
      expect(signal).toBeInstanceOf(AbortSignal);
      controller.abort();
      expect(signal.aborted).toBe(true);
      throw new DOMException("aborted", "AbortError");
    });
    const request = new Request("http://localhost/api/chats/11111111-1111-4111-8111-111111111111/messages", {
      method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Cancel me", answerMode: "standard", attachments: [] }),
    });
    const response = await POST(request, { params: Promise.resolve({ chatId: "11111111-1111-4111-8111-111111111111" }) });
    expect(response!.status).toBe(499);
    expect(mocks.persistUploadedImages).not.toHaveBeenCalled();
    expect(mocks.persistChatExchange).not.toHaveBeenCalled();
  });

  it("returns every message and degrades only attachments whose signed URL fails", async () => {
    mocks.getChatById.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111" });
    mocks.listMessages.mockResolvedValue([
      { id: "user", role: "user", content_text: "What is this?", message_attachments: [
        { id: "valid-a", storage_path: "uploaded/a.png", mime_type: "image/png" },
        { id: "missing", storage_path: "uploaded/missing.png", mime_type: "image/png" },
        { id: "valid-c", storage_path: "uploaded/c.png", mime_type: "image/png" },
      ] },
      { id: "assistant", role: "assistant", content_text: "", message_attachments: [
        { id: "generated-missing", storage_path: "generated/missing.webp", mime_type: "image/webp" },
      ] },
      { id: "later-user", role: "user", content_text: "Later", message_attachments: [] },
      { id: "later-assistant", role: "assistant", content_text: "Still here", message_attachments: [] },
    ]);
    mocks.createSignedReadUrl.mockImplementation(async (path) => {
      if (path.includes("missing")) throw { statusCode: 404, message: "Object not found" };
      return `signed:${path}`;
    });
    const response = await GET(new Request("http://local"), { params: Promise.resolve({ chatId: "11111111-1111-4111-8111-111111111111" }) });
    expect(response!.status).toBe(200);
    const body = await response!.json();
    expect(body.data).toHaveLength(4);
    expect(body.data[0].attachments.map((item: { availability: string }) => item.availability)).toEqual(["available", "unavailable", "available"]);
    expect(body.data[0].attachments[1]).toEqual(expect.objectContaining({ signedUrl: null, availability: "unavailable" }));
    expect(body.data[1].attachments[0]).toEqual(expect.objectContaining({ signedUrl: null, availability: "unavailable" }));
  });
});
