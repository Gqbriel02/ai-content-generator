import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireSession: vi.fn(), find: vi.fn(), update: vi.fn(), deleteProfile: vi.fn(), removeMedia: vi.fn(), clearCookie: vi.fn() }));
vi.mock("@/lib/auth/require-session", () => ({ requireSession: mocks.requireSession }));
vi.mock("@/lib/auth/session", () => ({ clearAuthCookie: mocks.clearCookie }));
vi.mock("@/lib/db/profile-repo", () => ({ findSafeProfileById: mocks.find, updateProfileAvatarColor: mocks.update, deleteProfileById: mocks.deleteProfile }));
vi.mock("@/lib/profile/profile-view", () => ({ withProfileAvatarUrl: vi.fn(async (profile) => ({ ...profile, avatarUrl: null })) }));
vi.mock("@/lib/storage/account-media", () => ({ removeProfileOwnedAccountMedia: mocks.removeMedia }));

import { DELETE, GET, PATCH } from "./route";

describe("/api/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSession.mockResolvedValue({ session: { profileId: "owner" } });
    mocks.find.mockResolvedValue({ id: "owner", email: "owner@example.com", displayName: "Owner", avatarPath: null,
      avatarColor: "#228BE6", createdAt: "2026-01-01", updatedAt: "2026-01-01" });
    mocks.update.mockImplementation(async (_id, avatarColor) => ({ id: "owner", avatarColor }));
    mocks.removeMedia.mockResolvedValue(undefined); mocks.deleteProfile.mockResolvedValue(true); mocks.clearCookie.mockResolvedValue(undefined);
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

  it("deletes storage, then the authenticated profile cascade, then clears the cookie", async () => {
    const response = await DELETE();
    expect(response!.status).toBe(200);
    expect(mocks.removeMedia).toHaveBeenCalledWith("owner");
    expect(mocks.deleteProfile).toHaveBeenCalledWith("owner");
    expect(mocks.clearCookie).toHaveBeenCalledOnce();
    expect(mocks.removeMedia.mock.invocationCallOrder[0]).toBeLessThan(mocks.deleteProfile.mock.invocationCallOrder[0]);
  });

  it("does nothing when unauthorized and ignores any client-selected profile", async () => {
    mocks.requireSession.mockResolvedValueOnce({ error: Response.json({ error: { message: "Unauthorized" } }, { status: 401 }) });
    expect((await DELETE())!.status).toBe(401);
    expect(mocks.removeMedia).not.toHaveBeenCalled(); expect(mocks.deleteProfile).not.toHaveBeenCalled();
    await (DELETE as unknown as (request: Request) => Promise<Response>)(new Request("http://localhost/api/profile", { method: "DELETE", body: JSON.stringify({ profileId: "other" }) }));
    expect(mocks.deleteProfile).toHaveBeenCalledWith("owner");
  });

  it("stops before database and cookie deletion when storage cleanup fails", async () => {
    mocks.removeMedia.mockRejectedValue(new Error("storage unavailable"));
    expect((await DELETE())!.status).toBe(503);
    expect(mocks.deleteProfile).not.toHaveBeenCalled(); expect(mocks.clearCookie).not.toHaveBeenCalled();
  });

  it("returns controlled failure without clearing the cookie when database deletion fails after storage", async () => {
    mocks.deleteProfile.mockRejectedValue(new Error("database unavailable"));
    const response = await DELETE(); const body = await response!.json();
    expect(response!.status).toBe(503); expect(body.error.message).toBe("Could not delete your account. Please try again.");
    expect(mocks.clearCookie).not.toHaveBeenCalled();
  });
});
