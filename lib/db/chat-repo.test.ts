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
  persistInitialChatExchange,
  deleteOwnedChat,
  updateChatRating,
  renameOwnedChat,
  moveOwnedChat,
} from "./chat-repo";

describe("moveOwnedChat", () => {
  beforeEach(() => from.mockReset());

  it("moves an owned chat to No Folder without changing any other field", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: "chat-id", folder_id: null }, error: null });
    const select = vi.fn(() => ({ maybeSingle }));
    const profileEq = vi.fn(() => ({ select }));
    const idEq = vi.fn(() => ({ eq: profileEq }));
    const update = vi.fn(() => ({ eq: idEq }));
    from.mockReturnValueOnce({ update });

    await expect(moveOwnedChat({ profileId: "owner", chatId: "chat-id", folderId: null }))
      .resolves.toEqual({ id: "chat-id", folder_id: null });
    expect(update).toHaveBeenCalledWith({ folder_id: null });
    expect(profileEq).toHaveBeenCalledWith("profile_id", "owner");
  });

  it("validates destination ownership before moving between folders", async () => {
    const folderSingle = vi.fn().mockResolvedValue({ data: { id: "folder-b" }, error: null });
    const folderProfileEq = vi.fn(() => ({ maybeSingle: folderSingle }));
    const folderIdEq = vi.fn(() => ({ eq: folderProfileEq }));
    const chatSingle = vi.fn().mockResolvedValue({ data: { id: "chat-id", folder_id: "folder-b" }, error: null });
    const select = vi.fn(() => ({ maybeSingle: chatSingle }));
    const chatProfileEq = vi.fn(() => ({ select }));
    const chatIdEq = vi.fn(() => ({ eq: chatProfileEq }));
    const update = vi.fn(() => ({ eq: chatIdEq }));
    from.mockReturnValueOnce({ select: vi.fn(() => ({ eq: folderIdEq })) }).mockReturnValueOnce({ update });

    await expect(moveOwnedChat({ profileId: "owner", chatId: "chat-id", folderId: "folder-b" }))
      .resolves.toMatchObject({ folder_id: "folder-b" });
    expect(folderProfileEq).toHaveBeenCalledWith("profile_id", "owner");
    expect(update).toHaveBeenCalledWith({ folder_id: "folder-b" });
  });

  it("does not update when the destination belongs to another user", async () => {
    const folderSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const folderProfileEq = vi.fn(() => ({ maybeSingle: folderSingle }));
    const folderIdEq = vi.fn(() => ({ eq: folderProfileEq }));
    from.mockReturnValueOnce({ select: vi.fn(() => ({ eq: folderIdEq })) });
    await expect(moveOwnedChat({ profileId: "owner", chatId: "chat-id", folderId: "foreign-folder" }))
      .resolves.toBeNull();
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("does not move another user's chat", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const select = vi.fn(() => ({ maybeSingle }));
    const profileEq = vi.fn(() => ({ select }));
    const idEq = vi.fn(() => ({ eq: profileEq }));
    from.mockReturnValueOnce({ update: vi.fn(() => ({ eq: idEq })) });
    await expect(moveOwnedChat({ profileId: "owner", chatId: "foreign-chat", folderId: null }))
      .resolves.toBeNull();
  });
});

describe("renameOwnedChat", () => {
  it("updates only the title of the owning profile's chat", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: "chat-id", title: "Renamed", folder_id: "folder-id" }, error: null });
    const select = vi.fn(() => ({ maybeSingle }));
    const profileEq = vi.fn(() => ({ select }));
    const idEq = vi.fn(() => ({ eq: profileEq }));
    const update = vi.fn(() => ({ eq: idEq }));
    from.mockReturnValueOnce({ update });

    await expect(renameOwnedChat("owner", "chat-id", "Renamed")).resolves.toMatchObject({ title: "Renamed", folder_id: "folder-id" });
    expect(update).toHaveBeenCalledWith({ title: "Renamed", updated_at: expect.any(String) });
    expect(idEq).toHaveBeenCalledWith("id", "chat-id");
    expect(profileEq).toHaveBeenCalledWith("profile_id", "owner");
  });

  it("returns null for a missing or unowned chat", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const select = vi.fn(() => ({ maybeSingle }));
    const profileEq = vi.fn(() => ({ select }));
    const idEq = vi.fn(() => ({ eq: profileEq }));
    from.mockReturnValueOnce({ update: vi.fn(() => ({ eq: idEq })) });
    await expect(renameOwnedChat("other-owner", "chat-id", "Renamed")).resolves.toBeNull();
  });
});

describe("deleteOwnedChat", () => {
  it("returns null and never issues a delete for a missing or unowned chat", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const profileEq = vi.fn(() => ({ maybeSingle }));
    const idEq = vi.fn(() => ({ eq: profileEq }));
    from.mockReturnValueOnce({ select: vi.fn(() => ({ eq: idEq })) });

    await expect(deleteOwnedChat("other-profile", "chat-id")).resolves.toBeNull();
    expect(idEq).toHaveBeenCalledWith("id", "chat-id");
    expect(profileEq).toHaveBeenCalledWith("profile_id", "other-profile");
  });

  it("deletes with a second ownership predicate and returns only unshared storage paths", async () => {
    const lookupSingle = vi.fn().mockResolvedValue({
      data: {
        id: "chat-id",
        messages: [{ message_attachments: [
          { id: "attachment-1", storage_path: "owner/exclusive.png" },
          { id: "attachment-2", storage_path: "owner/shared.png" },
        ] }],
      },
      error: null,
    });
    const lookupProfileEq = vi.fn(() => ({ maybeSingle: lookupSingle }));
    const lookupIdEq = vi.fn(() => ({ eq: lookupProfileEq }));

    const inPaths = vi.fn().mockResolvedValue({
      data: [
        { id: "attachment-1", storage_path: "owner/exclusive.png" },
        { id: "attachment-2", storage_path: "owner/shared.png" },
        { id: "other-chat-attachment", storage_path: "owner/shared.png" },
      ],
      error: null,
    });

    const deleteSingle = vi.fn().mockResolvedValue({ data: { id: "chat-id" }, error: null });
    const deleteSelect = vi.fn(() => ({ maybeSingle: deleteSingle }));
    const deleteProfileEq = vi.fn(() => ({ select: deleteSelect }));
    const deleteIdEq = vi.fn(() => ({ eq: deleteProfileEq }));
    const deleteCall = vi.fn(() => ({ eq: deleteIdEq }));

    from
      .mockReturnValueOnce({ select: vi.fn(() => ({ eq: lookupIdEq })) })
      .mockReturnValueOnce({ select: vi.fn(() => ({ in: inPaths })) })
      .mockReturnValueOnce({ delete: deleteCall });

    await expect(deleteOwnedChat("owner-profile", "chat-id")).resolves.toEqual({
      storagePaths: ["owner/exclusive.png"],
    });
    expect(deleteIdEq).toHaveBeenCalledWith("id", "chat-id");
    expect(deleteProfileEq).toHaveBeenCalledWith("profile_id", "owner-profile");
  });
});

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
      p_attachments: [],
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

describe("persistInitialChatExchange", () => {
  it("delegates chat, messages, answer mode, folder, and attachments to one RPC", async () => {
    rpc.mockResolvedValue({ data: {
      chat: { id: "new-chat", folder_id: "folder-id" },
      userMessage: { id: "user-id" }, assistantMessage: { id: "assistant-id" },
    }, error: null });
    await expect(persistInitialChatExchange({ chatId: "00000000-0000-4000-8000-000000000009",
      profileId: "profile-id", folderId: "folder-id", title: "Chat title", modelName: "model",
      userContent: "Prompt", assistantContent: "Reply", assistantAnswerMode: "tutorial",
      attachments: [{ storagePath: "profile-id/image.png", mimeType: "image/png", sizeBytes: 12 }],
    })).resolves.toMatchObject({ chat: { id: "new-chat" } });
    expect(rpc).toHaveBeenCalledWith("persist_initial_chat_exchange", expect.objectContaining({
      p_profile_id: "profile-id", p_folder_id: "folder-id", p_assistant_answer_mode: "tutorial",
      p_attachments: [{ storage_path: "profile-id/image.png", mime_type: "image/png", width: null, height: null, size_bytes: 12 }],
    }));
  });

  it("rejects an atomic persistence failure", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("transaction failed") });
    await expect(persistInitialChatExchange({ chatId: "00000000-0000-4000-8000-000000000009",
      profileId: "profile-id", folderId: null, title: "Chat", modelName: "model",
      userContent: "Prompt", assistantContent: "Reply", assistantAnswerMode: "standard", attachments: [],
    })).rejects.toThrow("transaction failed");
  });

  it("matches migration 0008 for an assistant image attachment and nullable answer mode", async () => {
    rpc.mockResolvedValue({ data: { chat: { id: "chat" }, userMessage: { id: "user" }, assistantMessage: { id: "assistant", answer_mode: null } }, error: null });
    await persistInitialChatExchange({ chatId: "00000000-0000-4000-8000-000000000009", profileId: "profile", folderId: null, title: "Image", modelName: "flux-2-klein-4b",
      userContent: "Prompt", assistantContent: "", assistantAnswerMode: null, attachmentTarget: "assistant",
      attachments: [{ storagePath: "profile/generated/id.webp", mimeType: "image/webp", width: 1024, height: 1024, sizeBytes: 42 }] });
    expect(rpc).toHaveBeenCalledWith("persist_initial_chat_exchange", {
      p_chat_id: "00000000-0000-4000-8000-000000000009",
      p_profile_id: "profile", p_folder_id: null, p_title: "Image", p_model_name: "flux-2-klein-4b",
      p_user_content: "Prompt", p_assistant_content: "", p_assistant_answer_mode: null,
      p_attachments: [{ storage_path: "profile/generated/id.webp", mime_type: "image/webp", width: 1024, height: 1024, size_bytes: 42 }],
      p_attachment_target: "assistant", p_assistant_payload: null,
    });
  });
});

describe("chat history", () => {
  const chats = [
    { id: "a", title: "First", created_at: "2025-01-01T00:00:00Z", messages: [{ content_text: "shared term" }] },
    { id: "b", title: "Shared term title", created_at: "2025-01-02T00:00:00Z", messages: [] },
  ];

  it("trims and matches titles case-insensitively without matching message content", () => {
    expect(filterAndSortChats(chats, " shared TERM ", "newest").map((chat) => chat.id)).toEqual(["b"]);
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
    expect(select).not.toHaveBeenCalledWith(expect.stringContaining("messages"));
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
