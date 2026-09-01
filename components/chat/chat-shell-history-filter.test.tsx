// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/chat",
  useParams: () => ({}),
}));

import { ChatShell } from "./chat-shell";

describe("ChatShell history content filter", () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    window.history.replaceState(null, "", "/chat");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn(() => ({
      matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    })) });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: {
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
    } });
    Object.defineProperty(document, "fonts", { configurable: true, value: {
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
    } });
    HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    fetchMock = vi.fn(() => Promise.resolve(Response.json({ data: [] })));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  async function renderShell(url = "/chat") {
    window.history.replaceState(null, "", url);
    await act(async () => {
      root.render(<MantineProvider><ChatShell /></MantineProvider>);
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  }

  it("defaults to All and uses the exact accessible labels", async () => {
    await renderShell();
    const control = document.querySelector('[aria-label="Filter history by content type"]');
    expect(control?.textContent).toContain("All");
    expect(control?.textContent).toContain("Text only");
    expect(control?.textContent).toContain("Images");
    expect((document.querySelector('input[value="all"]') as HTMLInputElement).checked).toBe(true);
  });

  it("restores Images from the URL and preserves search and sort when changed", async () => {
    await renderShell("/chat?q=cat&sort=oldest&type=image");
    expect((document.querySelector('input[value="image"]') as HTMLInputElement).checked).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/chats?q=cat&sort=oldest&type=image");

    await act(async () => (document.querySelector('input[value="text"]') as HTMLInputElement).click());
    expect(window.location.search).toBe("?q=cat&sort=oldest&type=text");
    expect(fetchMock).toHaveBeenCalledWith("/api/chats?q=cat&sort=oldest&type=text");
  });
});
