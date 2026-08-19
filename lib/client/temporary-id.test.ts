import { describe, expect, it, vi } from "vitest";
import { createClientTemporaryId } from "./temporary-id";

describe("createClientTemporaryId", () => {
  it("uses browser randomUUID when available", () => {
    const randomUUID = vi.fn(() => "browser-uuid");
    expect(createClientTemporaryId({ randomUUID })).toBe("browser-uuid");
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it("uses getRandomValues when randomUUID is unavailable", () => {
    let seed = 0;
    const crypto = { getRandomValues: <T extends ArrayBufferView | null>(value: T) => {
      const bytes = value as Uint8Array;
      bytes.forEach((_, index) => { bytes[index] = seed + index; });
      seed += 16;
      return value;
    } };
    const first = createClientTemporaryId(crypto);
    const second = createClientTemporaryId(crypto);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(second).not.toBe(first);
  });

  it("has a frontend-local last-resort fallback without browser crypto", () => {
    expect(createClientTemporaryId(undefined)).not.toBe(createClientTemporaryId(undefined));
  });
});
