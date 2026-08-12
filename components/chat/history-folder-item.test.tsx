// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HistoryFolderItem } from "./history-folder-item";

describe("HistoryFolderItem", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    });
    global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function render(items = ["Folder A", "Folder B"], onNewChat = vi.fn()) {
    await act(async () => {
      root.render(<MantineProvider>{items.map((name) => (
        <HistoryFolderItem key={name} name={name} onNewChat={onNewChat} onRename={vi.fn()} onDelete={vi.fn()}>
          <span>{name} chat</span>
        </HistoryFolderItem>
      ))}</MantineProvider>);
    });
  }

  it("starts expanded and collapses and expands folders independently", async () => {
    await render();
    const first = document.querySelector<HTMLButtonElement>('[aria-label="Collapse Folder A"]')!;
    const second = document.querySelector<HTMLButtonElement>('[aria-label="Collapse Folder B"]')!;
    expect(first.getAttribute("aria-expanded")).toBe("true");
    expect(document.body.textContent).toContain("Folder A chat");

    await act(async () => first.click());
    expect(document.querySelector('[aria-label="Expand Folder A"]')?.getAttribute("aria-expanded")).toBe("false");
    expect(second.getAttribute("aria-expanded")).toBe("true");

    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Expand Folder A"]')!.click());
    expect(document.querySelector('[aria-label="Collapse Folder A"]')?.getAttribute("aria-expanded")).toBe("true");
  });

  it("does not invoke new chat while toggling and expands before a new chat", async () => {
    const onNewChat = vi.fn();
    await render(["Folder A"], onNewChat);
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Collapse Folder A"]')!.click());
    expect(onNewChat).not.toHaveBeenCalled();
    expect(document.querySelector('[role="menu"]')).toBeNull();

    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="New chat in Folder A"]')!.click());
    expect(onNewChat).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[aria-label="Collapse Folder A"]')?.getAttribute("aria-expanded")).toBe("true");
  });

  it("preserves collapse state when the folder name changes under the same key", async () => {
    await act(async () => {
      root.render(<MantineProvider><HistoryFolderItem name="Folder A" onNewChat={vi.fn()} onRename={vi.fn()} onDelete={vi.fn()}>
        <span>Folder A chat</span>
      </HistoryFolderItem></MantineProvider>);
    });
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Collapse Folder A"]')!.click());
    await act(async () => {
      root.render(<MantineProvider><HistoryFolderItem name="Renamed" onNewChat={vi.fn()} onRename={vi.fn()} onDelete={vi.fn()}>
        <span>Renamed chat</span>
      </HistoryFolderItem></MantineProvider>);
    });
    expect(document.querySelector('[aria-label="Expand Renamed"]')?.getAttribute("aria-expanded")).toBe("false");
  });

  it("disables the chevron and shows an empty-folder tooltip when there are no chats", async () => {
    await act(async () => {
      root.render(<MantineProvider><HistoryFolderItem name="Empty" onNewChat={vi.fn()} onRename={vi.fn()} onDelete={vi.fn()}>
        {[]}
      </HistoryFolderItem></MantineProvider>);
    });
    const chevron = document.querySelector<HTMLButtonElement>('[aria-label="No chats in Empty"]')!;
    expect(chevron.disabled).toBe(true);
    expect(chevron.getAttribute("aria-expanded")).toBeNull();

    await act(async () => chevron.click());
    expect(chevron.disabled).toBe(true);

    expect(chevron.parentElement?.getAttribute("title")).toBe("No chats in this folder");
    expect(document.body.textContent).not.toContain("Collapse folder");
    expect(document.body.textContent).not.toContain("Expand folder");
  });
});
