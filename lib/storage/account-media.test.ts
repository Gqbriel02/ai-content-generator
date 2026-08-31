import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/db/supabase", () => ({ createServerSupabaseClient: () => ({ storage: { from: mocks.from } }) }));

import { removeProfileOwnedAccountMedia, removeStoragePrefix } from "./account-media";

const profileA = "8e9047ca-6105-40b5-aa1d-000000000001";

describe("account media cleanup", () => {
  beforeEach(() => mocks.from.mockReset());

  it("recursively removes chat and profile objects only under the authenticated profile prefix", async () => {
    const removed: Record<string, string[][]> = { chat: [], profile: [] };
    mocks.from.mockImplementation((bucket: string) => ({
      list: vi.fn(async (path: string) => {
        const entries: Record<string, Array<{ id: string | null; name: string; metadata?: unknown }>> = bucket === "chat" ? {
          [profileA]: [{ id: null, name: "chat1" }, { id: null, name: "chat2" }],
          [`${profileA}/chat1`]: [{ id: null, name: "uploaded" }, { id: null, name: "generated" }],
          [`${profileA}/chat1/uploaded`]: [{ id: "1", name: "a.jpg", metadata: {} }],
          [`${profileA}/chat1/generated`]: [{ id: "2", name: "b.webp", metadata: {} }],
          [`${profileA}/chat2`]: [{ id: null, name: "generated" }],
          [`${profileA}/chat2/generated`]: [{ id: "3", name: "c.webp", metadata: {} }],
        } : {
          [profileA]: [{ id: null, name: "avatar" }],
          [`${profileA}/avatar`]: [{ id: "4", name: "current.webp", metadata: {} }, { id: "5", name: "orphan.webp", metadata: {} }],
        };
        return { data: entries[path] ?? [], error: null };
      }),
      remove: vi.fn(async (paths: string[]) => { removed[bucket].push(paths); return { error: null }; }),
    }));

    await removeProfileOwnedAccountMedia(profileA);
    expect(removed.chat.flat()).toEqual(expect.arrayContaining([
      `${profileA}/chat1/uploaded/a.jpg`, `${profileA}/chat1/generated/b.webp`, `${profileA}/chat2/generated/c.webp`,
    ]));
    expect(removed.profile.flat()).toEqual(expect.arrayContaining([
      `${profileA}/avatar/current.webp`, `${profileA}/avatar/orphan.webp`,
    ]));
    expect(JSON.stringify(removed)).not.toContain("profile-b");
  });

  it("continues through list pages and removes objects in bounded batches", async () => {
    const entries = Array.from({ length: 101 }, (_, index) => ({ id: String(index), name: `${index}.webp`, metadata: {} }));
    const list = vi.fn(async (_path: string, options: { offset: number; limit: number }) => ({
      data: entries.slice(options.offset, options.offset + options.limit), error: null,
    }));
    const remove = vi.fn().mockResolvedValue({ error: null });
    mocks.from.mockReturnValue({ list, remove });
    await removeStoragePrefix("chat", profileA);
    expect(list).toHaveBeenCalledTimes(2);
    expect(remove).toHaveBeenCalledTimes(2);
    expect(remove.mock.calls.flatMap(([paths]) => paths)).toHaveLength(101);
  });

  it("treats empty or already-missing prefixes as successfully cleaned", async () => {
    const remove = vi.fn();
    mocks.from.mockReturnValue({ list: vi.fn().mockResolvedValue({ data: [], error: null }), remove });
    await expect(removeProfileOwnedAccountMedia(profileA)).resolves.toBeUndefined();
    expect(remove).not.toHaveBeenCalled();
  });

  it("continues when Storage reports an object as already absent without an error", async () => {
    const list = vi.fn()
      .mockResolvedValueOnce({ data: [{ id: "gone", name: "already-missing.webp", metadata: {} }], error: null })
      .mockResolvedValue({ data: [], error: null });
    const remove = vi.fn().mockResolvedValue({ data: [], error: null });
    mocks.from.mockReturnValue({ list, remove });
    await expect(removeStoragePrefix("chat", profileA)).resolves.toBeUndefined();
    expect(remove).toHaveBeenCalledWith([`${profileA}/already-missing.webp`]);
  });

  it("rejects unsafe owner prefixes and propagates genuine storage failures", async () => {
    await expect(removeStoragePrefix("chat", "../profile-b")).rejects.toThrow("Invalid account media owner");
    mocks.from.mockReturnValue({ list: vi.fn().mockResolvedValue({ data: null, error: new Error("unavailable") }), remove: vi.fn() });
    await expect(removeProfileOwnedAccountMedia(profileA)).rejects.toThrow("unavailable");
  });
});
