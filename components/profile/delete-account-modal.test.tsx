// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteAccountModal } from "./delete-account-modal";

describe("DeleteAccountModal", () => {
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

  async function render(opened: boolean, onClose = vi.fn(), onConfirm = vi.fn(), deleting = false) {
    await act(async () => { root.render(<MantineProvider><DeleteAccountModal opened={opened} deleting={deleting} onClose={onClose} onConfirm={onConfirm} /></MantineProvider>); await new Promise((resolve) => setTimeout(resolve, 250)); });
  }
  const deleteButton = () => Array.from(document.querySelectorAll("button")).find((item) => item.textContent?.trim() === "Delete account") as HTMLButtonElement;
  const checkbox = () => document.querySelector('input[type="checkbox"]') as HTMLInputElement;
  const input = () => document.querySelector('input[placeholder="DELETE"]') as HTMLInputElement;
  async function type(value: string) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => { setter?.call(input(), value); input().dispatchEvent(new Event("input", { bubbles: true })); });
  }

  it("requires both acknowledgement and exact trimmed uppercase DELETE", async () => {
    const confirm = vi.fn(); await render(true, vi.fn(), confirm);
    expect(document.body.textContent).toContain("Delete account?");
    expect(checkbox().checked).toBe(false); expect(input().value).toBe(""); expect(deleteButton().disabled).toBe(true);
    await act(async () => checkbox().click()); expect(deleteButton().disabled).toBe(true);
    for (const wrong of ["delete", "Delete", "DELET", "DELETE ACCOUNT"]) { await type(wrong); expect(deleteButton().disabled).toBe(true); }
    await type(" DELETE "); expect(deleteButton().disabled).toBe(false);
    await act(async () => checkbox().click()); expect(deleteButton().disabled).toBe(true); expect(confirm).not.toHaveBeenCalled();
  });

  it("does not allow text-only or Enter to bypass confirmation", async () => {
    const confirm = vi.fn(); await render(true, vi.fn(), confirm); await type("DELETE");
    expect(deleteButton().disabled).toBe(true);
    await act(async () => (document.querySelector("form") as HTMLFormElement).dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(confirm).not.toHaveBeenCalled();
  });

  it("confirms once when valid and disables every control while deleting", async () => {
    const confirm = vi.fn(); await render(true, vi.fn(), confirm);
    await act(async () => checkbox().click()); await type("DELETE"); await act(async () => deleteButton().click());
    expect(confirm).toHaveBeenCalledOnce();
    await render(true, vi.fn(), confirm, true);
    expect(checkbox().disabled).toBe(true); expect(input().disabled).toBe(true); expect(deleteButton().disabled).toBe(true);
    expect(Array.from(document.querySelectorAll("button")).find((item) => item.textContent?.trim() === "Cancel")?.hasAttribute("disabled")).toBe(true);
    expect(document.querySelector(".mantine-Modal-close")).toBeNull();
  });

  it("resets acknowledgement and text after Cancel and X dismissal", async () => {
    const close = vi.fn(); await render(true, close); await act(async () => checkbox().click()); await type("DELETE");
    const cancel = Array.from(document.querySelectorAll("button")).find((item) => item.textContent?.trim() === "Cancel") as HTMLButtonElement;
    await act(async () => cancel.click()); expect(close).toHaveBeenCalledOnce();
    await render(false, close); await render(true, close); expect(checkbox().checked).toBe(false); expect(input().value).toBe("");
    await act(async () => checkbox().click()); await type("DELETE");
    await act(async () => (document.querySelector(".mantine-Modal-close") as HTMLButtonElement).click());
    await render(false, close); await render(true, close); expect(checkbox().checked).toBe(false); expect(input().value).toBe("");
  });
});
