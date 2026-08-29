import { describe, expect, it, vi } from "vitest";

const createSigned = vi.hoisted(() => vi.fn());
vi.mock("@/lib/storage/profile-avatar", () => ({ createProfileAvatarSignedUrl: createSigned }));
import { withProfileAvatarUrl } from "./profile-view";

const profile = { id: "owner", email: "owner@example.com", displayName: "Owner", avatarPath: "owner/avatar/id.png",
  avatarColor: "#E64980", createdAt: "2026-01-01", updatedAt: "2026-01-01" };

describe("profile avatar view", () => {
  it("adds a runtime signed URL without replacing the stable path", async () => {
    createSigned.mockResolvedValue("https://private.example/signed");
    await expect(withProfileAvatarUrl(profile)).resolves.toEqual({ ...profile, avatarUrl: "https://private.example/signed" });
  });

  it("falls back without mutating the path when signing fails", async () => {
    createSigned.mockRejectedValue(new Error("Object not found"));
    await expect(withProfileAvatarUrl(profile)).resolves.toEqual({ ...profile, avatarUrl: null });
  });
});
