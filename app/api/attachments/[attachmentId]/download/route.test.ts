import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireSession, findOwnedGeneratedAttachment, downloadAttachmentObject } = vi.hoisted(() => ({
  requireSession: vi.fn(),
  findOwnedGeneratedAttachment: vi.fn(),
  downloadAttachmentObject: vi.fn(),
}));

vi.mock("@/lib/auth/require-session", () => ({ requireSession }));
vi.mock("@/lib/db/chat-repo", () => ({ findOwnedGeneratedAttachment }));
vi.mock("@/lib/storage/attachments", () => ({ downloadAttachmentObject }));

import { GET } from "./route";

const ATTACHMENT_ID = "4ee45488-d978-4d96-8e89-e0338587dce7";

function context(attachmentId = ATTACHMENT_ID) {
  return { params: Promise.resolve({ attachmentId }) };
}

describe("GET /api/attachments/[attachmentId]/download", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSession.mockResolvedValue({ session: { profileId: "owner-profile" } });
  });

  it("returns the original private object bytes with download headers for an owned generated image", async () => {
    const originalBytes = new Uint8Array([82, 73, 70, 70, 1, 2, 3]);
    findOwnedGeneratedAttachment.mockResolvedValue({
      id: ATTACHMENT_ID,
      storagePath: "owner-profile/chat-id/generated/image.webp",
      mimeType: "image/webp",
    });
    downloadAttachmentObject.mockResolvedValue(new Blob([originalBytes], { type: "image/webp" }));

    const response = await GET(new Request("http://localhost"), context());

    expect(response!.status).toBe(200);
    expect(response!.headers.get("content-type")).toBe("image/webp");
    expect(response!.headers.get("content-disposition")).toBe('attachment; filename="generated-image-4ee45488.webp"');
    expect(new Uint8Array(await response!.arrayBuffer())).toEqual(originalBytes);
    expect(findOwnedGeneratedAttachment).toHaveBeenCalledWith("owner-profile", ATTACHMENT_ID);
    expect(downloadAttachmentObject).toHaveBeenCalledWith("owner-profile/chat-id/generated/image.webp");
  });

  it.each(["missing attachment", "attachment owned by another profile"])("returns the same 404 for a %s", async () => {
    findOwnedGeneratedAttachment.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost"), context());
    expect(response!.status).toBe(404);
    expect(downloadAttachmentObject).not.toHaveBeenCalled();
  });

  it("requires authentication before looking up the attachment", async () => {
    requireSession.mockResolvedValue({ error: Response.json({}, { status: 401 }) });
    const response = await GET(new Request("http://localhost"), context());
    expect(response!.status).toBe(401);
    expect(findOwnedGeneratedAttachment).not.toHaveBeenCalled();
  });
});
