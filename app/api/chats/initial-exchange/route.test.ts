import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(), findFolderById: vi.fn(), persistInitialChatExchange: vi.fn(),
  hitRateLimit: vi.fn(), generateAssistantReply: vi.fn(), generateChatTitle: vi.fn(), isLmStudioRequestCanceled: vi.fn(),
}));
vi.mock("@/lib/auth/require-session", () => ({ requireSession: mocks.requireSession }));
vi.mock("@/lib/db/chat-repo", () => ({ findFolderById: mocks.findFolderById, persistInitialChatExchange: mocks.persistInitialChatExchange }));
vi.mock("@/lib/http/rate-limit", () => ({ hitRateLimit: mocks.hitRateLimit }));
vi.mock("@/lib/storage/attachments", () => ({ createSignedReadUrl: vi.fn(), deleteAttachmentObjects: vi.fn() }));
vi.mock("@/lib/ai/lmstudio", () => ({ generateAssistantReply: mocks.generateAssistantReply, generateChatTitle: mocks.generateChatTitle,
  isLmStudioRequestCanceled: mocks.isLmStudioRequestCanceled, LmStudioError: class extends Error {} }));

import { POST } from "./route";

describe("POST /api/chats/initial-exchange title generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSession.mockResolvedValue({ session: { profileId: "profile-id" } });
    mocks.hitRateLimit.mockReturnValue(false);
    mocks.findFolderById.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111" });
    mocks.generateAssistantReply.mockResolvedValue("Electrolysis splits water into hydrogen and oxygen.");
    mocks.isLmStudioRequestCanceled.mockImplementation((_error, signal) => signal?.aborted === true);
    mocks.persistInitialChatExchange.mockImplementation(async (input) => ({
      chat: { id: "chat-id", title: input.title, folder_id: input.folderId }, userMessage: { id: "user" }, assistantMessage: { id: "assistant" },
    }));
  });

  function request(folderId: string | null = null) {
    return new Request("http://localhost/api/chats/initial-exchange", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "How does electrolysis work?", answerMode: "detailed", attachments: [], folderId }),
    });
  }

  it("generates a title from only the first exchange and atomically persists the sanitized result", async () => {
    mocks.generateChatTitle.mockResolvedValue('  Title: "How Water Electrolysis Works."  ');
    const response = await POST(request("11111111-1111-4111-8111-111111111111"));
    expect(response?.status).toBe(201);
    expect(mocks.generateChatTitle).toHaveBeenCalledOnce();
    expect(mocks.generateChatTitle).toHaveBeenCalledWith({
      userMessage: "How does electrolysis work?",
      assistantMessage: "Electrolysis splits water into hydrogen and oxygen.",
    }, expect.any(AbortSignal));
    expect(mocks.persistInitialChatExchange).toHaveBeenCalledWith(expect.objectContaining({
      title: "How Water Electrolysis Works", folderId: "11111111-1111-4111-8111-111111111111",
    }));
  });

  it("persists with the prompt fallback when title generation fails", async () => {
    mocks.generateChatTitle.mockRejectedValue(new Error("title model unavailable"));
    const response = await POST(request());
    expect(response?.status).toBe(201);
    expect(mocks.persistInitialChatExchange).toHaveBeenCalledWith(expect.objectContaining({
      title: "How Does Electrolysis Work", folderId: null,
    }));
  });

  it("passes the incoming signal and does not title or persist a canceled initial exchange", async () => {
    const controller = new AbortController();
    const aborted = new DOMException("aborted", "AbortError");
    mocks.generateAssistantReply.mockImplementation(async (_messages, _mode, signal) => {
      expect(signal).toBeInstanceOf(AbortSignal);
      controller.abort();
      expect(signal.aborted).toBe(true);
      throw aborted;
    });
    const response = await POST(new Request("http://localhost/api/chats/initial-exchange", {
      method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Cancel me", answerMode: "standard", attachments: [], folderId: null }),
    }));
    expect(response!.status).toBe(499);
    expect(mocks.generateChatTitle).not.toHaveBeenCalled();
    expect(mocks.persistInitialChatExchange).not.toHaveBeenCalled();
  });
});
