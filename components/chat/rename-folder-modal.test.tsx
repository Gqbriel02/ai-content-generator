// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RenameFolderModal } from "./rename-folder-modal";

function setInputValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("RenameFolderModal", () => {
  let container: HTMLDivElement;
  let root: Root;
  const folder = { id: "folder-id", name: "Math" };

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
    vi.stubGlobal("fetch", vi.fn());
    Object.defineProperty(window, "matchMedia", { writable: true, value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) });
    global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  });

  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

  async function render(opened = true, onClose = vi.fn(), onRenamed = vi.fn()) {
    await act(async () => { root.render(<MantineProvider><RenameFolderModal folder={folder} opened={opened} onClose={onClose} onRenamed={onRenamed} /></MantineProvider>); await new Promise((resolve) => setTimeout(resolve, 250)); });
    return { onClose, onRenamed };
  }

  function renameButton() {
    return [...document.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Rename")!;
  }

  it("shows the current name and protects against blank and unchanged names", async () => {
    await render();
    expect(document.body.textContent).toContain("Current name");
    expect(document.body.textContent).toContain("Math");
    const input = document.querySelector<HTMLInputElement>("input")!;
    expect(input.value).toBe("");
    expect(renameButton().disabled).toBe(true);

    await act(async () => setInputValue(input, "   "));
    expect(renameButton().disabled).toBe(true);
    await act(async () => setInputValue(input, "Math"));
    expect(renameButton().disabled).toBe(true);
    await act(async () => setInputValue(input, "  Math  "));
    expect(renameButton().disabled).toBe(true);
    await act(async () => setInputValue(input, "Science"));
    expect(renameButton().disabled).toBe(false);
  });

  it("submits the trimmed folder name", async () => {
    const { onRenamed } = await render();
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ data: { ...folder, name: "Science" } }));
    const input = document.querySelector<HTMLInputElement>("input")!;
    await act(async () => {
      setInputValue(input, "  Science  ");
      input.closest("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(fetch).toHaveBeenCalledWith("/api/folders/folder-id", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ name: "Science" }) }));
    expect(onRenamed).toHaveBeenCalledWith(expect.objectContaining({ name: "Science" }));
  });

  it("clears an abandoned name when reopened", async () => {
    await render();
    await act(async () => setInputValue(document.querySelector<HTMLInputElement>("input")!, "Geometry"));
    await act(async () => { root.render(<MantineProvider>{null}</MantineProvider>); });
    await render(true);
    expect(document.querySelector<HTMLInputElement>("input")?.value).toBe("");
    expect(renameButton().disabled).toBe(true);
  });
});
