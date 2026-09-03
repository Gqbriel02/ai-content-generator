// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RenameChatModal } from "./rename-chat-modal";

function setInputValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("RenameChatModal", () => {
  let container: HTMLDivElement;
  let root: Root;
  const chat = { id: "chat-id", title: "Current title", folder_id: "folder-id" };

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
    vi.stubGlobal("fetch", vi.fn());
    Object.defineProperty(window, "matchMedia", { writable: true, value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) });
    global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

  async function render(onClose = vi.fn(), onRenamed = vi.fn()) {
    await act(async () => { root.render(<MantineProvider><RenameChatModal chat={chat} onClose={onClose} onRenamed={onRenamed} /></MantineProvider>); await new Promise((resolve) => setTimeout(resolve, 250)); });
    return { onClose, onRenamed };
  }

  function renameButton() {
    return [...document.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Rename")!;
  }

  it("shows the current title and only enables Rename for a different nonblank title", async () => {
    const { onClose } = await render();
    expect(document.body.textContent).toContain("Current name");
    expect(document.body.textContent).toContain("Current title");
    const input = document.querySelector<HTMLInputElement>("input")!;
    expect(input.value).toBe("");
    expect(renameButton().disabled).toBe(true);

    await act(async () => setInputValue(input, "   "));
    expect(renameButton().disabled).toBe(true);
    await act(async () => setInputValue(input, "Current title"));
    expect(renameButton().disabled).toBe(true);
    await act(async () => setInputValue(input, "  Current title  "));
    expect(renameButton().disabled).toBe(true);
    await act(async () => setInputValue(input, "Different title"));
    expect(renameButton().disabled).toBe(false);

    const cancel = [...document.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Cancel")!;
    await act(async () => cancel.click());
    expect(onClose).toHaveBeenCalledOnce(); expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects whitespace and submits a trimmed title without changing the folder", async () => {
    const { onRenamed } = await render();
    const input = document.querySelector<HTMLInputElement>("input")!;
    const form = input.closest("form")!;
    await act(async () => { setInputValue(input, "   "); form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(fetch).not.toHaveBeenCalled();

    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ data: { ...chat, title: "Renamed" } }));
    await act(async () => { setInputValue(input, "  Renamed  "); form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(fetch).toHaveBeenCalledWith("/api/chats/chat-id", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ title: "Renamed" }) }));
    expect(onRenamed).toHaveBeenCalledWith(expect.objectContaining({ title: "Renamed", folder_id: "folder-id" }));
  });

  it("starts empty again after closing and reopening", async () => {
    await render();
    const input = document.querySelector<HTMLInputElement>("input")!;
    await act(async () => setInputValue(input, "Abandoned title"));
    await act(async () => { root.render(<MantineProvider>{null}</MantineProvider>); });
    await act(async () => { root.render(<MantineProvider><RenameChatModal chat={chat} onClose={vi.fn()} onRenamed={vi.fn()} /></MantineProvider>); await new Promise((resolve) => setTimeout(resolve, 250)); });
    expect(document.querySelector<HTMLInputElement>("input")?.value).toBe("");
  });
});
