import { describe, expect, it, vi } from "vitest";
import { prepareImageForLmStudio } from "./lmstudio-image";

describe("prepareImageForLmStudio", () => {
  it.each(["image/jpeg", "image/png"] as const)("passes %s through without conversion", async (mimeType) => {
    const bytes = Uint8Array.from([1, 2, 3]).buffer;
    const convert = vi.fn();
    const result = await prepareImageForLmStudio({ bytes, mimeType }, convert);
    expect(convert).not.toHaveBeenCalled();
    expect(result.mimeType).toBe(mimeType);
    expect([...result.bytes]).toEqual([1, 2, 3]);
  });

  it("converts WebP to PNG for inference", async () => {
    const convert = vi.fn(async () => Uint8Array.from([137, 80, 78, 71]));
    const result = await prepareImageForLmStudio({ bytes: Uint8Array.from([82, 73, 70, 70]).buffer, mimeType: "image/webp" }, convert);
    expect(convert).toHaveBeenCalledOnce();
    expect(result).toEqual({ bytes: Uint8Array.from([137, 80, 78, 71]), mimeType: "image/png" });
    const dataUrl = `data:${result.mimeType};base64,${Buffer.from(result.bytes).toString("base64")}`;
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(dataUrl).not.toContain("data:image/webp;base64,");
  });

  it("maps conversion failures to a safe input-processing error", async () => {
    await expect(prepareImageForLmStudio(
      { bytes: Uint8Array.from([82, 73, 70, 70]).buffer, mimeType: "image/webp" },
      async () => { throw new Error("decoder details"); },
    )).rejects.toThrow("could not be prepared");
  });
});
