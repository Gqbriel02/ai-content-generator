import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireSession, listChats } = vi.hoisted(() => ({
  requireSession: vi.fn(),
  listChats: vi.fn(),
}));

vi.mock("@/lib/auth/require-session", () => ({ requireSession }));
vi.mock("@/lib/db/chat-repo", () => ({ listChats }));

import { GET } from "./route";

describe("GET /api/chats content filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSession.mockResolvedValue({ session: { profileId: "owner" } });
    listChats.mockResolvedValue([]);
  });

  it("defaults to all and passes composed query values to the repository", async () => {
    const response = await GET(new Request("http://localhost/api/chats?q=cat&sort=oldest"));
    expect(response!.status).toBe(200);
    expect(listChats).toHaveBeenCalledWith("owner", { search: "cat", sort: "oldest", type: "all" });
  });

  it("accepts image filtering", async () => {
    const response = await GET(new Request("http://localhost/api/chats?type=image"));
    expect(response!.status).toBe(200);
    expect(listChats).toHaveBeenCalledWith("owner", { search: "", sort: "newest", type: "image" });
  });

  it("returns a controlled 400 for an invalid filter", async () => {
    const response = await GET(new Request("http://localhost/api/chats?type=video"));
    expect(response!.status).toBe(400);
    expect(listChats).not.toHaveBeenCalled();
  });
});
