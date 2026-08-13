// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MoveChatModal } from "./move-chat-modal";

const chat = { id: "chat-id", title: "A very long recipe conversation title", folder_id: "folder-a", rating: null } as const;
const folders = [{ id: "folder-a", name: "Recipes" }, { id: "folder-b", name: "Work" }];

describe("MoveChatModal", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    Object.defineProperty(window, "matchMedia", { writable: true, value: vi.fn(() => ({
      matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    })) });
    global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function renderModal(
    onMove = vi.fn().mockResolvedValue(true),
    options: Partial<React.ComponentProps<typeof MoveChatModal>> = {},
  ) {
    const onClose = vi.fn();
    await act(async () => {
      root.render(<MantineProvider><MoveChatModal chat={chat} folders={folders} onClose={onClose}
        onFolderCreated={vi.fn()} onMove={onMove} {...options} /></MantineProvider>);
      await new Promise((resolve) => setTimeout(resolve, 250));
    });
    return { onMove, onClose };
  }

  it("shows every destination, selects the current folder, and disables an unchanged move", async () => {
    const { onMove } = await renderModal();
    expect(document.body.textContent).toContain("Current chat location: Recipes");
    expect(document.body.textContent).toContain("No Folder");
    expect(document.body.textContent).toContain("Recipes");
    expect(document.body.textContent).toContain("Work");
    expect(document.querySelector<HTMLInputElement>('input[value="folder-a"]')?.checked).toBe(true);
    const move = [...document.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent === "Move")!;
    expect(move.disabled).toBe(true);
    expect(onMove).not.toHaveBeenCalled();
  });

  it("enables a changed destination and prevents duplicate submissions", async () => {
    let resolveMove!: (value: boolean) => void;
    const onMove = vi.fn(() => new Promise<boolean>((resolve) => { resolveMove = resolve; }));
    const { onClose } = await renderModal(onMove);
    await act(async () => document.querySelector<HTMLInputElement>('input[value="folder-b"]')!.click());
    const move = [...document.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent === "Move")!;
    expect(move.disabled).toBe(false);
    await act(async () => { move.click(); move.click(); });
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledWith(chat, "folder-b");
    await act(async () => resolveMove(true));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the modal open when moving fails", async () => {
    const { onClose } = await renderModal(vi.fn().mockResolvedValue(false));
    await act(async () => document.querySelector<HTMLInputElement>('input[value="__no_folder__"]')!.click());
    const move = [...document.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent === "Move")!;
    await act(async () => { move.click(); await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(onClose).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Move chat");
  });

  it("keeps fixed controls outside a four-row folder ScrollArea while all folders remain selectable", async () => {
    const manyFolders = Array.from({ length: 10 }, (_, index) => ({
      id: `folder-${index}`,
      name: index === 9 ? "A very long dissertation research and artificial intelligence folder" : `Folder ${index + 1}`,
    }));
    const currentChat = { ...chat, folder_id: "folder-9" };
    const onMove = vi.fn().mockResolvedValue(true);
    await renderModal(onMove, { chat: currentChat, folders: manyFolders });

    const scrollArea = document.querySelector<HTMLElement>("[data-folder-scroll-area]")!;
    expect(scrollArea).not.toBeNull();
    expect(scrollArea.style.maxHeight).toContain("9rem");
    expect(scrollArea.querySelectorAll("[data-folder-destination]")).toHaveLength(10);
    expect(scrollArea.querySelector<HTMLInputElement>('input[value="folder-9"]')?.checked).toBe(true);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });

    const noFolder = document.querySelector<HTMLInputElement>('input[value="__no_folder__"]')!;
    const createFolder = [...document.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.includes("Create new folder"))!;
    const cancel = [...document.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent === "Cancel")!;
    const move = [...document.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent === "Move")!;
    expect(scrollArea.contains(noFolder)).toBe(false);
    expect(scrollArea.contains(createFolder)).toBe(false);
    expect(scrollArea.contains(cancel)).toBe(false);
    expect(scrollArea.contains(move)).toBe(false);

    await act(async () => document.querySelector<HTMLInputElement>('input[value="folder-5"]')!.click());
    expect(move.disabled).toBe(false);
    await act(async () => { move.click(); await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(onMove).toHaveBeenCalledWith(currentChat, "folder-5");
  });

  it("keeps No Folder selected outside the list and can move into a scrolled folder", async () => {
    const noFolderChat = { ...chat, folder_id: null };
    const onMove = vi.fn().mockResolvedValue(true);
    await renderModal(onMove, { chat: noFolderChat });
    expect(document.querySelector<HTMLInputElement>('input[value="__no_folder__"]')?.checked).toBe(true);
    await act(async () => document.querySelector<HTMLInputElement>('input[value="folder-b"]')!.click());
    const move = [...document.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Move")!;
    await act(async () => { move.click(); await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(onMove).toHaveBeenCalledWith(noFolderChat, "folder-b");
  });
});
