// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteChatModal } from "./delete-chat-modal";
import { DeleteFolderModal } from "./delete-folder-modal";

describe("destructive acknowledgement modals", () => {
  let container: HTMLDivElement; let root: Root;
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
    Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: { addEventListener: vi.fn(), removeEventListener: vi.fn() } });
    Object.defineProperty(document, "fonts", { configurable: true, value: { addEventListener: vi.fn(), removeEventListener: vi.fn() } });
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

  async function render(element: React.ReactNode) {
    await act(async () => { root.render(<MantineProvider>{element}</MantineProvider>); await new Promise((resolve) => setTimeout(resolve, 20)); });
  }
  function button(label: string) {
    return Array.from(document.querySelectorAll("button")).find((item) => item.textContent?.trim() === label) as HTMLButtonElement;
  }

  it("gates chat deletion, supports unchecking, and Enter cannot bypass the disabled button", async () => {
    const confirm = vi.fn();
    await render(<DeleteChatModal opened deleting={false} onClose={vi.fn()} onConfirm={confirm} />);
    const checkbox = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox.checked).toBe(false); expect(button("Delete").disabled).toBe(true);
    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(confirm).not.toHaveBeenCalled();
    await act(async () => checkbox.click()); expect(button("Delete").disabled).toBe(false);
    await act(async () => checkbox.click()); expect(button("Delete").disabled).toBe(true);
    await act(async () => checkbox.click()); await act(async () => button("Delete").click());
    expect(confirm).toHaveBeenCalledOnce();
  });

  it("resets chat acknowledgement after Cancel and modal X close", async () => {
    const close = vi.fn(); const props = { deleting: false, onClose: close, onConfirm: vi.fn() };
    await render(<DeleteChatModal opened {...props} />);
    await act(async () => (document.querySelector('input[type="checkbox"]') as HTMLInputElement).click());
    await act(async () => button("Cancel").click()); expect(close).toHaveBeenCalledOnce();
    await render(<DeleteChatModal opened={false} {...props} />); await render(<DeleteChatModal opened {...props} />);
    expect((document.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(false);
    await act(async () => (document.querySelector('input[type="checkbox"]') as HTMLInputElement).click());
    const closeButton = document.querySelector("button.mantine-Modal-close") as HTMLButtonElement;
    await act(async () => closeButton.click());
    await render(<DeleteChatModal opened={false} {...props} />); await render(<DeleteChatModal opened {...props} />);
    expect((document.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(false);
  });

  it("gates folder deletion with explicit wording and resets between targets", async () => {
    const confirm = vi.fn(); const close = vi.fn();
    await render(<DeleteFolderModal key="folder-a" opened deleting={false} onClose={close} onConfirm={confirm} />);
    const checkbox = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(document.body.textContent).toContain("I understand that this will permanently delete the folder and all chats inside it.");
    expect(button("Delete folder").disabled).toBe(true);
    await act(async () => checkbox.click()); expect(button("Delete folder").disabled).toBe(false);
    await act(async () => checkbox.click()); expect(button("Delete folder").disabled).toBe(true);
    await act(async () => checkbox.click()); await act(async () => button("Cancel").click());
    await render(<DeleteFolderModal key="folder-b" opened deleting={false} onClose={close} onConfirm={confirm} />);
    expect((document.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(false);
    expect(button("Delete folder").disabled).toBe(true); expect(confirm).not.toHaveBeenCalled();
  });

  it("keeps chat and folder acknowledgements isolated and disables controls while deleting", async () => {
    await render(<><DeleteChatModal opened deleting={false} onClose={vi.fn()} onConfirm={vi.fn()} /><DeleteFolderModal opened deleting={false} onClose={vi.fn()} onConfirm={vi.fn()} /></>);
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    await act(async () => (checkboxes[0] as HTMLInputElement).click());
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(true); expect((checkboxes[1] as HTMLInputElement).checked).toBe(false);
    await render(<DeleteFolderModal opened deleting onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect((document.querySelector('input[type="checkbox"]') as HTMLInputElement).disabled).toBe(true);
    expect(button("Delete folder").disabled).toBe(true); expect(button("Cancel").disabled).toBe(true);
  });
});
