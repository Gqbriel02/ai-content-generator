// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/chat/chat-id", useParams: () => ({ chatId: "chat-id" }) }));
import { buildImageRequestForm, ChatShell } from "./chat-shell";

describe("ChatShell generated-image reuse", () => {
  let container: HTMLDivElement; let root: Root;
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
    Object.defineProperty(window, "matchMedia", { writable: true,
      value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) });
    Object.defineProperty(window, "visualViewport", { writable: true,
      value: { addEventListener: vi.fn(), removeEventListener: vi.fn() } });
    Object.defineProperty(document, "fonts", { configurable: true,
      value: { addEventListener: vi.fn(), removeEventListener: vi.fn() } });
    HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/folders" || url === "/api/chats") return Response.json({ data: [] });
      if (url === "/api/chats/chat-id") return Response.json({ data: { id: "chat-id", folder_id: null, rating: null } });
      if (url === "/api/chats/chat-id/messages") return Response.json({ data: [{ id: "assistant-message", role: "assistant", content_text: "",
        attachments: [{ id: "00000000-0000-4000-8000-000000000011", storagePath: "owner/chat-id/generated/old.webp", mimeType: "image/webp", signedUrl: "signed-preview" }] }] });
      throw new Error(`Unexpected fetch: ${url}`);
    }));
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

  it("closes the viewer, switches to Image mode, previews the reference, and removes it locally", async () => {
    await act(async () => { root.render(<MantineProvider><ChatShell /></MantineProvider>); await new Promise((resolve) => setTimeout(resolve, 20)); });
    await act(async () => (document.querySelector('button[aria-label="View generated image"]') as HTMLButtonElement).click());
    const reuse = [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Reuse")) as HTMLButtonElement;
    await act(async () => reuse.click());
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect((document.querySelector('[aria-label="Generation type"]') as HTMLInputElement).textContent).toContain("Image");
    expect(document.querySelector('img[alt="Preview"]')?.getAttribute("src")).toBe("signed-preview");
    await act(async () => (document.querySelector('button[aria-label="Remove image"]') as HTMLButtonElement).click());
    expect(document.querySelector('img[alt="Preview"]')).toBeNull();
    expect(document.querySelector('button[aria-label="View generated image"]')).not.toBeNull();
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("builds a request with only the reused attachment ID and no browser file bytes", () => {
    const body = buildImageRequestForm("Make it greener", "1:1", null, [{ source: "existing", id: "id",
      attachmentId: "00000000-0000-4000-8000-000000000011", mimeType: "image/webp",
      signedUrl: "signed-preview", storagePath: "existing:id" }]);
    expect(body.getAll("referenceAttachmentIds")).toEqual(["00000000-0000-4000-8000-000000000011"]);
    expect(body.getAll("files")).toEqual([]);
  });
});
