import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(), find: vi.fn(), updatePath: vi.fn(), validate: vi.fn(), upload: vi.fn(), remove: vi.fn(), withUrl: vi.fn(),
}));
vi.mock("@/lib/auth/require-session", () => ({ requireSession: mocks.requireSession }));
vi.mock("@/lib/db/profile-repo", () => ({ findSafeProfileById: mocks.find, updateProfileAvatarPath: mocks.updatePath }));
vi.mock("@/lib/profile/profile-view", () => ({ withProfileAvatarUrl: mocks.withUrl }));
vi.mock("@/lib/storage/profile-avatar", () => ({
  ProfileAvatarValidationError: class extends Error {}, validateProfileAvatar: mocks.validate,
  uploadProfileAvatar: mocks.upload, removeProfileAvatarObject: mocks.remove,
}));

import { DELETE, POST } from "./route";

const owner = "8e9047ca-6105-40b5-aa1d-d03b0f87ba46";
const oldPath = `${owner}/avatar/11111111-1111-4111-8111-111111111111.png`;
const newPath = `${owner}/avatar/22222222-2222-4222-8222-222222222222.webp`;
const baseProfile = { id: owner, email: "owner@example.com", displayName: "Owner", avatarPath: null,
  avatarColor: "#E64980", createdAt: "2026-01-01", updatedAt: "2026-01-01" };

function uploadRequest() {
  const data = new FormData(); data.set("avatar", new File([Uint8Array.from([1])], "browser-name.webp", { type: "image/webp" }));
  return new Request("http://localhost/api/profile/avatar", { method: "POST", body: data });
}

describe("/api/profile/avatar", () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.requireSession.mockResolvedValue({ session: { profileId: owner } });
    mocks.find.mockResolvedValue(baseProfile);
    mocks.validate.mockResolvedValue({ bytes: new ArrayBuffer(1), mimeType: "image/webp" });
    mocks.upload.mockResolvedValue(newPath); mocks.remove.mockResolvedValue(undefined);
    mocks.updatePath.mockImplementation(async (_profileId, avatarPath) => ({ ...baseProfile, avatarPath }));
    mocks.withUrl.mockImplementation(async (profile) => ({ ...profile, avatarUrl: profile.avatarPath ? "https://private/signed" : null }));
  });

  it("uploads a new object, then persists its path without touching fallback color", async () => {
    const response = await POST(uploadRequest());
    expect(response!.status).toBe(201);
    expect(mocks.upload).toHaveBeenCalledWith(owner, expect.objectContaining({ mimeType: "image/webp" }));
    expect(mocks.updatePath).toHaveBeenCalledWith(owner, newPath);
    expect(mocks.remove).not.toHaveBeenCalled();
    expect((await response!.json()).data.avatarColor).toBe("#E64980");
  });

  it("uploads and persists replacement before deleting the old object", async () => {
    mocks.find.mockResolvedValue({ ...baseProfile, avatarPath: oldPath });
    const response = await POST(uploadRequest());
    expect(response!.status).toBe(201);
    expect(mocks.upload.mock.invocationCallOrder[0]).toBeLessThan(mocks.updatePath.mock.invocationCallOrder[0]);
    expect(mocks.updatePath.mock.invocationCallOrder[0]).toBeLessThan(mocks.remove.mock.invocationCallOrder[0]);
    expect(mocks.remove).toHaveBeenCalledWith(owner, oldPath);
  });

  it("cleans only the new object when database persistence fails and retains old authority", async () => {
    mocks.find.mockResolvedValue({ ...baseProfile, avatarPath: oldPath });
    mocks.updatePath.mockRejectedValue(new Error("database unavailable"));
    const response = await POST(uploadRequest());
    expect(response!.status).toBe(500);
    expect(mocks.remove).toHaveBeenCalledOnce();
    expect(mocks.remove).toHaveBeenCalledWith(owner, newPath);
    expect(mocks.remove).not.toHaveBeenCalledWith(owner, oldPath);
  });

  it("reports replacement success when old-object cleanup fails", async () => {
    mocks.find.mockResolvedValue({ ...baseProfile, avatarPath: oldPath });
    mocks.remove.mockRejectedValue(new Error("cleanup unavailable"));
    const response = await POST(uploadRequest());
    expect(response!.status).toBe(201);
    expect(mocks.updatePath).toHaveBeenCalledWith(owner, newPath);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Previous profile avatar cleanup failed"), expect.any(Error));
  });

  it("clears the database before removing the current object and preserves color", async () => {
    mocks.find.mockResolvedValue({ ...baseProfile, avatarPath: oldPath });
    const response = await DELETE();
    expect(response!.status).toBe(200);
    expect(mocks.updatePath).toHaveBeenCalledWith(owner, null);
    expect(mocks.updatePath.mock.invocationCallOrder[0]).toBeLessThan(mocks.remove.mock.invocationCallOrder[0]);
    expect((await response!.json()).data.avatarColor).toBe("#E64980");
  });

  it("keeps removal successful when object cleanup fails", async () => {
    mocks.find.mockResolvedValue({ ...baseProfile, avatarPath: oldPath }); mocks.remove.mockRejectedValue(new Error("storage unavailable"));
    const response = await DELETE();
    expect(response!.status).toBe(200); expect(mocks.updatePath).toHaveBeenCalledWith(owner, null);
  });

  it("treats removal with no avatar as an idempotent no-op", async () => {
    const response = await DELETE();
    expect(response!.status).toBe(200); expect(mocks.updatePath).not.toHaveBeenCalled(); expect(mocks.remove).not.toHaveBeenCalled();
  });

  it.each(["POST", "DELETE"])("does no work for unauthorized %s", async (method) => {
    mocks.requireSession.mockResolvedValue({ error: Response.json({ error: { message: "Unauthorized" } }, { status: 401 }) });
    const response = method === "POST" ? await POST(uploadRequest()) : await DELETE();
    expect(response!.status).toBe(401); expect(mocks.find).not.toHaveBeenCalled(); expect(mocks.upload).not.toHaveBeenCalled(); expect(mocks.updatePath).not.toHaveBeenCalled();
  });

  it("has no client profile ID or path contract", async () => {
    const data = new FormData(); data.set("profileId", "another-user"); data.set("avatarPath", "another/avatar/file.png");
    const response = await POST(new Request("http://localhost/api/profile/avatar", { method: "POST", body: data }));
    expect(response!.status).toBe(400); expect(mocks.upload).not.toHaveBeenCalled(); expect(mocks.updatePath).not.toHaveBeenCalled();
  });
});
