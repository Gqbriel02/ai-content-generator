import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireSession: vi.fn(), find: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/auth/require-session", () => ({ requireSession: mocks.requireSession }));
vi.mock("@/lib/db/profile-repo", () => ({ findSafeProfileById: mocks.find, updateProfileAvatarColor: mocks.update }));

import { GET, PATCH } from "./route";

describe("/api/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSession.mockResolvedValue({ session: { profileId: "owner" } });
    mocks.find.mockResolvedValue({ id: "owner", email: "owner@example.com", displayName: "Owner", avatarPath: null,
      avatarColor: "#228BE6", createdAt: "2026-01-01", updatedAt: "2026-01-01" });
    mocks.update.mockImplementation(async (_id, avatarColor) => ({ id: "owner", avatarColor }));
  });

  it("returns an authenticated safe profile", async () => {
    const response = await GET();
    expect(response!.status).toBe(200);
    expect(JSON.stringify(await response!.json())).not.toContain("password_hash");
    expect(mocks.find).toHaveBeenCalledWith("owner");
  });

  it("normalizes color and derives ownership from the session", async () => {
    const response = await PATCH(new Request("http://localhost/api/profile", { method: "PATCH",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ avatarColor: "#7c3aed" }) }));
    expect(response!.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith("owner", "#7C3AED");
  });

  it.each([{ avatarColor: "red" }, { avatarColor: "#123" }, { avatarColor: "#12345678" },
    { avatarColor: "#ZZZZZZ" }, { avatarColor: "#228BE6", profileId: "other" }, {}])(
    "rejects invalid or over-broad update %#", async (body) => {
      const response = await PATCH(new Request("http://localhost/api/profile", { method: "PATCH",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
      expect(response!.status).toBe(400);
      expect(mocks.update).not.toHaveBeenCalled();
    },
  );
});
