import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/lib/db/supabase", () => ({
  createServerSupabaseClient: () => ({ rpc }),
}));

import { persistChatExchange } from "./chat-repo";

describe("persistChatExchange", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("persists and returns a complete exchange through one RPC call", async () => {
    const userMessage = { id: "user-id", role: "user", content_text: "Prompt" };
    const assistantMessage = { id: "assistant-id", role: "assistant", content_text: "Response" };
    rpc.mockResolvedValue({ data: { userMessage, assistantMessage }, error: null });

    await expect(
      persistChatExchange({
        chatId: "chat-id",
        profileId: "profile-id",
        userContent: "Prompt",
        assistantContent: "Response",
      }),
    ).resolves.toEqual({ userMessage, assistantMessage });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("persist_chat_exchange", {
      p_chat_id: "chat-id",
      p_profile_id: "profile-id",
      p_user_content: "Prompt",
      p_assistant_content: "Response",
      p_assistant_payload: null,
    });
  });

  it("rejects a database persistence failure", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("database unavailable") });

    await expect(
      persistChatExchange({
        chatId: "chat-id",
        profileId: "profile-id",
        userContent: "Prompt",
        assistantContent: "Response",
      }),
    ).rejects.toThrow("database unavailable");
  });
});
