import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(), findChatById: vi.fn(), getChatById: vi.fn(), listMessages: vi.fn(),
  persistChatExchange: vi.fn(), hitRateLimit: vi.fn(), generateAssistantReply: vi.fn(),
  isLmStudioRequestCanceled: vi.fn(), persistUploadedImages: vi.fn(),
}));
vi.mock("@/lib/auth/require-session", () => ({ requireSession: mocks.requireSession }));
vi.mock("@/lib/db/chat-repo", () => ({ findChatById: mocks.findChatById, getChatById: mocks.getChatById,
  listMessages: mocks.listMessages, persistChatExchange: mocks.persistChatExchange }));
vi.mock("@/lib/http/rate-limit", () => ({ hitRateLimit: mocks.hitRateLimit }));
vi.mock("@/lib/storage/attachments", () => ({ createSignedReadUrl: vi.fn(), deleteAttachmentObjects: vi.fn() }));
vi.mock("@/lib/storage/uploaded-images", () => ({ persistUploadedImages: mocks.persistUploadedImages, validatePendingImages: vi.fn() }));
vi.mock("@/lib/ai/lmstudio", () => ({ generateAssistantReply: mocks.generateAssistantReply,
  isLmStudioRequestCanceled: mocks.isLmStudioRequestCanceled, LmStudioError: class extends Error {} }));

import { POST } from "./route";

describe("POST /api/chats/[chatId]/messages cancellation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSession.mockResolvedValue({ session: { profileId: "profile-id" } });
    mocks.findChatById.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111" });
    mocks.listMessages.mockResolvedValue([{ role: "assistant", content_text: "Existing response" }]);
    mocks.hitRateLimit.mockReturnValue(false);
    mocks.isLmStudioRequestCanceled.mockImplementation((_error, signal) => signal?.aborted === true);
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
});
