type BrowserCrypto = {
  randomUUID?: () => string;
  getRandomValues?: <T extends ArrayBufferView | null>(array: T) => T;
};

let fallbackSequence = 0;

/** Frontend-local identity only. Never use this for persistence, storage paths, auth, or security. */
export function createClientTemporaryId(
  browserCrypto: BrowserCrypto | undefined = typeof globalThis.crypto === "undefined" ? undefined : globalThis.crypto,
) {
  if (typeof browserCrypto?.randomUUID === "function") return browserCrypto.randomUUID();

  if (typeof browserCrypto?.getRandomValues === "function") {
    const bytes = browserCrypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  fallbackSequence += 1;
  return `local-${Date.now().toString(36)}-${fallbackSequence.toString(36)}`;
}
