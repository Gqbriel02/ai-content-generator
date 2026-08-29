// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/chat",
  useParams: () => ({}),
}));

import { ChatShell } from "./chat-shell";

describe("ChatShell text cancellation", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    Object.defineProperty(window, "matchMedia", { writable: true,
      value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) });
    Object.defineProperty(window, "visualViewport", { writable: true,
      value: { addEventListener: vi.fn(), removeEventListener: vi.fn() } });
    Object.defineProperty(document, "fonts", { configurable: true,
      value: { addEventListener: vi.fn(), removeEventListener: vi.fn() } });
    HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  async function renderShell(fetchImpl: typeof fetch) {
    vi.stubGlobal("fetch", fetchImpl);
    await act(async () => {
      root.render(<MantineProvider><ChatShell /></MantineProvider>);
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  }

  async function enterPrompt(value = "Explain quantum computing") {
    const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      setter?.call(textarea, value);
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
    });
  }

  async function enterPromptAndSend(value = "Explain quantum computing") {
    await enterPrompt(value);
    const send = document.querySelector('button[aria-label="send"]') as HTMLButtonElement;
    expect(send.disabled).toBe(false);
    await act(async () => { send.click(); await Promise.resolve(); });
  }

  it("aborts only the active text request, keeps the temporary exchange, restores controls, and allows retry", async () => {
    let requestSignal: AbortSignal | undefined;
    let imageInit: RequestInit | undefined;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/folders" || url === "/api/chats") return Promise.resolve(Response.json({ data: [] }));
      if (url === "/api/chats/initial-exchange") {
        requestSignal = init?.signal ?? undefined;
        return new Promise<Response>((_resolve, reject) => requestSignal?.addEventListener("abort", () =>
          reject(new DOMException("This operation was aborted", "AbortError")), { once: true }));
      }
      if (url === "/api/chats/initial-image-exchange") { imageInit = init; return new Promise<Response>(() => undefined); }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;
    await renderShell(fetchMock);
    await enterPromptAndSend();

    expect(document.querySelector('button[aria-label="Cancel generation"]')).not.toBeNull();
    expect(document.body.textContent).toContain("Loading...");
    await act(async () => (document.querySelector('button[aria-label="Cancel generation"]') as HTMLButtonElement).click());

    expect(requestSignal?.aborted).toBe(true);
    expect(document.body.textContent).toContain("Explain quantum computing");
    expect(document.body.textContent).toContain("The request was canceled.");
    expect(document.body.textContent).not.toContain("Rate this response");
    expect((document.querySelector("textarea") as HTMLTextAreaElement).disabled).toBe(false);
    expect((document.querySelector('button[aria-label="upload-image"]') as HTMLButtonElement).disabled).toBe(false);
    expect(document.querySelector('button[aria-label="send"]')).not.toBeNull();
    expect(router.push).not.toHaveBeenCalled();

    const imageChoice = document.querySelector('input[value="image"]') as HTMLInputElement;
    await act(async () => imageChoice.click());
    await enterPromptAndSend("A castle at sunset");

    expect(document.body.textContent).toContain("Generating image...");
    expect(document.querySelector('button[aria-label="Cancel generation"]')).toBeNull();
    expect(imageInit).not.toHaveProperty("signal");
  });

  it("renders both closed delete modals without a duplicate-key warning", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/folders" || url === "/api/chats") return Promise.resolve(Response.json({ data: [] }));
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;
    await renderShell(fetchMock);
    const duplicateKeyWarnings = consoleError.mock.calls.filter((call) =>
      call.some((value) => String(value).includes("Encountered two children with the same key")),
    );
    expect(duplicateKeyWarnings).toEqual([]);
  });
});
