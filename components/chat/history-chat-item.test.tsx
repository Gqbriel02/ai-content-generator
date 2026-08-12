// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HistoryChatItem } from "./history-chat-item";

describe("HistoryChatItem", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("opens its menu without selecting the chat and invokes deletion only from the menu item", async () => {
    const onSelect = vi.fn();
    const onDelete = vi.fn();
    await act(async () => {
      root.render(
        <MantineProvider>
          <HistoryChatItem
            id="chat-id"
            title="A very long chat title"
            href="/chat/chat-id"
            active={false}
            onSelect={onSelect}
            onDelete={onDelete}
          />
        </MantineProvider>,
      );
    });

    const menuButton = document.querySelector<HTMLButtonElement>('[aria-label="More options"]');
    expect(menuButton).not.toBeNull();
    await act(async () => {
      menuButton!.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
      menuButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 250));
    });

    expect(onSelect).not.toHaveBeenCalled();
    const deleteItem = [...document.querySelectorAll<HTMLElement>("[role=menuitem]")]
      .find((item) => item.textContent?.includes("Delete chat"));
    expect(deleteItem).toBeDefined();

    await act(async () => deleteItem!.click());
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
