import { beforeEach, describe, expect, it, vi } from "vitest";

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/db/supabase", () => ({ createServerSupabaseClient: () => ({ from }) }));

import { findSafeProfileById, updateProfileAvatarColor } from "./profile-repo";

const row = { id: "owner", email: "owner@example.com", display_name: "Owner User", avatar_path: null,
  avatar_color: "#228BE6", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" };

describe("profile repository", () => {
  beforeEach(() => from.mockReset());

  it("loads only explicit safe fields and never password_hash", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    from.mockReturnValue({ select });
    await expect(findSafeProfileById("owner")).resolves.toMatchObject({ displayName: "Owner User" });
    expect(select).toHaveBeenCalledWith(expect.not.stringContaining("password_hash"));
    expect(select).not.toHaveBeenCalledWith("*");
    expect(eq).toHaveBeenCalledWith("id", "owner");
  });

  it("updates only the authenticated profile identity and timestamp", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { ...row, avatar_color: "#7950F2" }, error: null });
    const select = vi.fn(() => ({ maybeSingle }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));
    from.mockReturnValue({ update });
    await expect(updateProfileAvatarColor("owner", "#7950F2")).resolves.toMatchObject({ avatarColor: "#7950F2" });
    expect(update).toHaveBeenCalledWith({ avatar_color: "#7950F2", updated_at: expect.any(String) });
    expect(eq).toHaveBeenCalledWith("id", "owner");
  });
});
