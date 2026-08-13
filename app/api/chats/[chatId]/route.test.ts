import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireSession, deleteOwnedChat, deleteAttachmentObjects, renameOwnedChat, moveOwnedChat } = vi.hoisted(() => ({
  requireSession: vi.fn(),
  deleteOwnedChat: vi.fn(),
  deleteAttachmentObjects: vi.fn(),
  renameOwnedChat: vi.fn(),
  moveOwnedChat: vi.fn(),
}));

vi.mock("@/lib/auth/require-session", () => ({ requireSession }));
vi.mock("@/lib/db/chat-repo", () => ({ deleteOwnedChat, renameOwnedChat, moveOwnedChat }));
vi.mock("@/lib/storage/attachments", () => ({ deleteAttachmentObjects }));
vi.mock("@/lib/db/supabase", () => ({ createServerSupabaseClient: vi.fn() }));

import { DELETE, PATCH } from "./route";

const CHAT_ID = "9b463696-7502-44e0-bd23-35ab3b0ce147";

function context(chatId = CHAT_ID) {
  return { params: Promise.resolve({ chatId }) } as RouteContext<"/api/chats/[chatId]">;
}

describe("PATCH /api/chats/[chatId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSession.mockResolvedValue({ session: { profileId: "owner-profile" } });
  });

  it("preserves rename behavior", async () => {
    renameOwnedChat.mockResolvedValue({ id: CHAT_ID, title: "Renamed" });
    const response = await PATCH(new Request("http://localhost", {
      method: "PATCH", body: JSON.stringify({ title: "Renamed" }),
    }), context());
    expect(response!.status).toBe(200);
    expect(renameOwnedChat).toHaveBeenCalledWith("owner-profile", CHAT_ID, "Renamed");
    expect(moveOwnedChat).not.toHaveBeenCalled();
  });

  it.each(["d442fea7-d74e-4fd2-a9f3-b06f55632a3f", null])("moves using authenticated ownership with folderId %s", async (folderId) => {
    moveOwnedChat.mockResolvedValue({ id: CHAT_ID, folder_id: folderId });
    const response = await PATCH(new Request("http://localhost", {
      method: "PATCH", body: JSON.stringify({ folderId }),
    }), context());
    expect(response!.status).toBe(200);
    expect(moveOwnedChat).toHaveBeenCalledWith({ profileId: "owner-profile", chatId: CHAT_ID, folderId });
  });

  it("rejects arbitrary or mixed fields", async () => {
    const response = await PATCH(new Request("http://localhost", {
      method: "PATCH", body: JSON.stringify({ title: "Rename", folderId: null, rating: 1 }),
    }), context());
    expect(response!.status).toBe(400);
    expect(renameOwnedChat).not.toHaveBeenCalled();
    expect(moveOwnedChat).not.toHaveBeenCalled();
  });

  it("uses the same not-found response for an unowned chat or destination", async () => {
    moveOwnedChat.mockResolvedValue(null);
    const response = await PATCH(new Request("http://localhost", {
      method: "PATCH", body: JSON.stringify({ folderId: null }),
    }), context());
    expect(response!.status).toBe(404);
  });
});

describe("DELETE /api/chats/[chatId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSession.mockResolvedValue({ session: { profileId: "owner-profile" } });
    deleteAttachmentObjects.mockResolvedValue(undefined);
  });

  it("rejects an unauthenticated request", async () => {
    requireSession.mockResolvedValue({ error: Response.json({}, { status: 401 }) });
    const response = await DELETE(new Request("http://localhost"), context());
    expect(response!.status).toBe(401);
    expect(deleteOwnedChat).not.toHaveBeenCalled();
  });

  it("deletes only through the authenticated owner's profile and cleans exclusive objects", async () => {
    deleteOwnedChat.mockResolvedValue({ storagePaths: ["owner/file.png"] });
    const response = await DELETE(new Request("http://localhost"), context());
    expect(response!.status).toBe(200);
    await expect(response!.json()).resolves.toEqual({ data: { success: true } });
    expect(deleteOwnedChat).toHaveBeenCalledWith("owner-profile", CHAT_ID);
    expect(deleteAttachmentObjects).toHaveBeenCalledWith(["owner/file.png"]);
  });

  it("does not reveal whether a missing chat belongs to another user", async () => {
    deleteOwnedChat.mockResolvedValue(null);
    const response = await DELETE(new Request("http://localhost"), context());
    expect(response!.status).toBe(404);
    expect(deleteAttachmentObjects).not.toHaveBeenCalled();
  });

  it("returns a stable database error without exposing details", async () => {
    deleteOwnedChat.mockRejectedValue(new Error("private database details"));
    const response = await DELETE(new Request("http://localhost"), context());
    expect(response!.status).toBe(500);
    const body = await response!.json();
    expect(body.error.message).toBe("The chat could not be deleted. Please try again.");
    expect(JSON.stringify(body)).not.toContain("private database details");
  });

  it("keeps a completed database deletion successful if best-effort storage cleanup fails", async () => {
    deleteOwnedChat.mockResolvedValue({ storagePaths: ["owner/file.png"] });
    deleteAttachmentObjects.mockRejectedValue(new Error("storage unavailable"));
    const response = await DELETE(new Request("http://localhost"), context());
    expect(response!.status).toBe(200);
  });
});
