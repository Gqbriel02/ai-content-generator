import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));

vi.mock("@/lib/db/supabase", () => ({
  createServerSupabaseClient: () => ({ rpc, from }),
}));

import {
  filterAndSortChats,
  listChats,
  listMessages,
  persistChatExchange,
  updateChatRating,
} from "./chat-repo";

describe("persistChatExchange", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it.each(["detailed", "tutorial"] as const)(
    "persists and returns a complete %s exchange through one RPC call",
    async (assistantAnswerMode) => {
    const userMessage = { id: "user-id", role: "user", content_text: "Prompt" };
    const assistantMessage = {
      id: "assistant-id",
      role: "assistant",
      content_text: "Response",
      answer_mode: assistantAnswerMode,
    };
    rpc.mockResolvedValue({ data: { userMessage, assistantMessage }, error: null });

    await expect(
      persistChatExchange({
        chatId: "chat-id",
        profileId: "profile-id",
        userContent: "Prompt",
        assistantContent: "Response",
        assistantAnswerMode,
      }),
    ).resolves.toEqual({ userMessage, assistantMessage });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("persist_chat_exchange", {
      p_chat_id: "chat-id",
      p_profile_id: "profile-id",
      p_user_content: "Prompt",
      p_assistant_content: "Response",
      p_assistant_answer_mode: assistantAnswerMode,
      p_assistant_payload: null,
    });
    },
  );

  it("rejects a database persistence failure", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("database unavailable") });

    await expect(
      persistChatExchange({
        chatId: "chat-id",
        profileId: "profile-id",
        userContent: "Prompt",
        assistantContent: "Response",
        assistantAnswerMode: "standard",
      }),
    ).rejects.toThrow("database unavailable");
  });
});

describe("chat history", () => {
  const chats = [
    { id: "a", title: "First", created_at: "2025-01-01T00:00:00Z", messages: [{ content_text: "shared term" }, { content_text: "shared term again" }] },
    { id: "b", title: "Shared term title", created_at: "2025-01-02T00:00:00Z", messages: [] },
  ];

  it("returns each matching chat once when multiple messages match", () => {
    expect(filterAndSortChats(chats, " shared TERM ", "newest").map((chat) => chat.id)).toEqual(["b", "a"]);
  });

  it("sorts oldest first and uses the id as a deterministic tie-breaker", () => {
    const tied = chats.map((chat) => ({ ...chat, created_at: "2025-01-01T00:00:00Z" }));
    expect(filterAndSortChats(tied, "", "oldest").map((chat) => chat.id)).toEqual(["a", "b"]);
  });

  it("scopes the Supabase history query to profile_id", async () => {
    const eq = vi.fn().mockResolvedValue({ data: [], error: null });
    const select = vi.fn(() => ({ eq }));
    from.mockReturnValueOnce({ select });
    await listChats("owner-profile");
    expect(from).toHaveBeenCalledWith("chats");
    expect(eq).toHaveBeenCalledWith("profile_id", "owner-profile");
    expect(select).toHaveBeenCalledWith(expect.stringContaining("title"));
    expect(select).toHaveBeenCalledWith(expect.stringContaining("model_name"));
  });
});

describe("message history", () => {
  it("loads persisted answer modes without selecting private prompt fields", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{ id: "assistant-id", role: "assistant", answer_mode: "detailed" }],
      error: null,
    });
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    from.mockReturnValueOnce({ select });

    await expect(listMessages("chat-id")).resolves.toEqual([
      { id: "assistant-id", role: "assistant", answer_mode: "detailed" },
    ]);

    expect(select).toHaveBeenCalledWith(expect.stringContaining("answer_mode"));
    expect(select).not.toHaveBeenCalledWith(expect.stringContaining("BASE_SYSTEM_PROMPT"));
    expect(select).not.toHaveBeenCalledWith(expect.stringContaining("ANSWER_MODE_PROMPTS"));
  });
});

describe("updateChatRating", () => {
  it.each([1, -1, null] as const)("updates %s only for the owning profile", async (rating) => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { rating }, error: null });
    const select = vi.fn(() => ({ maybeSingle }));
    const profileEq = vi.fn(() => ({ select }));
    const idEq = vi.fn(() => ({ eq: profileEq }));
    const update = vi.fn(() => ({ eq: idEq }));
    from.mockReturnValueOnce({ update });

    await expect(updateChatRating("owner-profile", "chat-id", rating)).resolves.toEqual({ rating });
    expect(update).toHaveBeenCalledWith({ rating });
    expect(idEq).toHaveBeenCalledWith("id", "chat-id");
    expect(profileEq).toHaveBeenCalledWith("profile_id", "owner-profile");
  });

  it("returns null for a missing or unowned chat", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const select = vi.fn(() => ({ maybeSingle }));
    const profileEq = vi.fn(() => ({ select }));
    const idEq = vi.fn(() => ({ eq: profileEq }));
    from.mockReturnValueOnce({ update: vi.fn(() => ({ eq: idEq })) });
    await expect(updateChatRating("other-profile", "chat-id", 1)).resolves.toBeNull();
  });
});
