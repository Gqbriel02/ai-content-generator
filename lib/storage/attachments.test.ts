import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ upload: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/config/env", () => ({ env: { NEXT_PUBLIC_SUPABASE_BUCKET: "bucket" } }));
vi.mock("@/lib/db/supabase", () => ({ createServerSupabaseClient: () => ({ storage: { from: mocks.from } }) }));
import { downloadAndStoreGeneratedImage } from "./attachments";

describe("generated image delivery and storage", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.from.mockReturnValue({ upload: mocks.upload }); mocks.upload.mockResolvedValue({ error: null }); });
  afterEach(() => vi.unstubAllGlobals());

  it("retries the same delivery URL and uploads valid image bytes", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(new Response(new Uint8Array([82, 73, 70, 70]), { headers: { "content-type": "image/webp" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(downloadAndStoreGeneratedImage({ temporaryUrl: "https://delivery.example/signed", profileId: "profile", width: 1, height: 1, sleep: async () => {} }))
      .resolves.toMatchObject({ mimeType: "image/webp", sizeBytes: 4 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.every(([url]) => url === "https://delivery.example/signed")).toBe(true);
    expect(mocks.upload).toHaveBeenCalledOnce();
  });

  it("categorizes a storage failure after a successful download", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Uint8Array([1]), { headers: { "content-type": "image/webp" } })));
    mocks.upload.mockResolvedValue({ error: { name: "StorageApiError" } });
    const promise = downloadAndStoreGeneratedImage({ temporaryUrl: "https://delivery.example/signed", profileId: "profile", width: 1, height: 1 });
    await expect(promise).rejects.toMatchObject({ code: "IMAGE_STORAGE_ERROR" });
  });
});
