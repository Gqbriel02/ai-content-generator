import { beforeEach, describe, expect, it, vi } from "vitest";

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/db/supabase", () => ({ createServerSupabaseClient: () => ({ from }) }));

import { createProfile, findProfileByEmail } from "./auth-repo";
import { DEFAULT_AVATAR_COLORS } from "@/lib/profile/identity";

describe("profile authentication persistence", () => {
  beforeEach(() => from.mockReset());

  it("creates a profile with a null avatar path and one persisted curated color", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: "new", email: "user@example.com" }, error: null });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    from.mockReturnValue({ insert });
    const avatarColor = DEFAULT_AVATAR_COLORS[3];
    await createProfile({ email: "USER@example.com", passwordHash: "secure-hash", displayName: "New User", avatarColor });
    expect(insert).toHaveBeenCalledWith({ email: "user@example.com", password_hash: "secure-hash", display_name: "New User",
      avatar_path: null, avatar_color: avatarColor });
    expect(DEFAULT_AVATAR_COLORS).toContain(avatarColor);
  });

  it("login lookup reads the persisted profile and never regenerates avatar color", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: "owner", email: "owner@example.com", password_hash: "hash",
      display_name: "Owner", avatar_color: "#E64980" }, error: null });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    from.mockReturnValue({ select });
    await findProfileByEmail("OWNER@example.com");
    expect(from).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalledWith("id, email, password_hash, display_name");
    expect(eq).toHaveBeenCalledWith("email", "owner@example.com");
  });
});
