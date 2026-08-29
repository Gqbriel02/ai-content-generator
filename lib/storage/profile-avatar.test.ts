import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), upload: vi.fn(), remove: vi.fn(), createSignedUrl: vi.fn() }));
vi.mock("@/lib/db/supabase", () => ({ createServerSupabaseClient: () => ({ storage: { from: mocks.from } }) }));

import {
  MAX_PROFILE_AVATAR_BYTES,
  PROFILE_MEDIA_BUCKET,
  buildProfileAvatarPath,
  createProfileAvatarSignedUrl,
  removeProfileAvatarObject,
  uploadProfileAvatar,
  validateProfileAvatar,
} from "./profile-avatar";

const profileId = "8e9047ca-6105-40b5-aa1d-d03b0f87ba46";
const objectId = "2f76a9fa-6dc7-4cb4-a940-f379d6212b23";
const signatures = {
  "image/jpeg": [0xff, 0xd8, 1, 0xff, 0xd9],
  "image/png": [137, 80, 78, 71, 13, 10, 26, 10],
  "image/webp": [82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80],
};

describe("profile avatar storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue({ upload: mocks.upload, remove: mocks.remove, createSignedUrl: mocks.createSignedUrl });
    mocks.upload.mockResolvedValue({ error: null }); mocks.remove.mockResolvedValue({ error: null });
    mocks.createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://private.example/signed" }, error: null });
  });

  it.each(Object.entries(signatures))("validates real %s signatures and preserves bytes", async (mimeType, values) => {
    const file = new File([Uint8Array.from(values)], `avatar.${mimeType.split("/")[1]}`, { type: mimeType });
    await expect(validateProfileAvatar(file)).resolves.toMatchObject({ mimeType, bytes: expect.any(ArrayBuffer) });
  });

  it.each([
    new File([], "empty.png", { type: "image/png" }),
    new File(["<svg/>"] , "avatar.svg", { type: "image/svg+xml" }),
    new File(["not png"], "renamed.png", { type: "image/png" }),
    new File(["hello"], "avatar.png", { type: "text/plain" }),
  ])("rejects empty, unsupported, or signature-invalid files before upload", async (file) => {
    await expect(validateProfileAvatar(file)).rejects.toThrow();
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("rejects files over 5 MB before reading or uploading", async () => {
    const file = new File([new Uint8Array(MAX_PROFILE_AVATAR_BYTES + 1)], "large.png", { type: "image/png" });
    await expect(validateProfileAvatar(file)).rejects.toThrow("5 MB or smaller");
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("builds only the authenticated profile avatar path", () => {
    expect(buildProfileAvatarPath(profileId, "image/jpeg", objectId)).toBe(`${profileId}/avatar/${objectId}.jpeg`);
    expect(() => buildProfileAvatarPath("another-user", "image/png", objectId)).toThrow();
  });

  it("uploads unchanged bytes to the private profile bucket", async () => {
    const bytes = Uint8Array.from(signatures["image/webp"]).buffer;
    const path = await uploadProfileAvatar(profileId, { bytes, mimeType: "image/webp" });
    expect(path).toMatch(new RegExp(`^${profileId}/avatar/.+\\.webp$`));
    expect(mocks.from).toHaveBeenCalledWith(PROFILE_MEDIA_BUCKET);
    expect(mocks.upload).toHaveBeenCalledWith(path, bytes, { contentType: "image/webp", upsert: false });
  });

  it("creates one-hour signed URLs and removes only owned paths", async () => {
    const path = `${profileId}/avatar/${objectId}.png`;
    await expect(createProfileAvatarSignedUrl(profileId, path)).resolves.toBe("https://private.example/signed");
    expect(mocks.createSignedUrl).toHaveBeenCalledWith(path, 3600);
    await removeProfileAvatarObject(profileId, path);
    expect(mocks.remove).toHaveBeenCalledWith([path]);
    await expect(removeProfileAvatarObject(profileId, `00000000-0000-4000-8000-000000000000/avatar/${objectId}.png`)).rejects.toThrow();
  });
});
