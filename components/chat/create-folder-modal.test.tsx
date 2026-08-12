// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreateFolderModal } from "./create-folder-modal";

const { showNotification } = vi.hoisted(() => ({ showNotification: vi.fn() }));
vi.mock("@mantine/notifications", () => ({
  notifications: { show: showNotification },
}));

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("CreateFolderModal", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    showNotification.mockReset();
    vi.stubGlobal("fetch", vi.fn());
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
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
    vi.unstubAllGlobals();
  });

  async function renderModal(props?: Partial<React.ComponentProps<typeof CreateFolderModal>>) {
    await act(async () => {
      root.render(
        <MantineProvider>
          <CreateFolderModal
            opened
            onClose={vi.fn()}
            onCreated={vi.fn()}
            {...props}
          />
        </MantineProvider>,
      );
      await new Promise((resolve) => setTimeout(resolve, 250));
    });
  }

  it("opens centered with an empty focused input and Cancel makes no request", async () => {
    const onClose = vi.fn();
    await renderModal({ onClose });

    const input = document.querySelector<HTMLInputElement>('input[placeholder="e.g. Dissertation"]');
    expect(input?.value).toBe("");
    expect(input?.hasAttribute("data-autofocus")).toBe(true);
    expect(document.querySelector("[data-centered]")).not.toBeNull();

    const cancel = [...document.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent === "Cancel");
    await act(async () => cancel?.click());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not submit empty or whitespace-only names", async () => {
    await renderModal();
    const input = document.querySelector<HTMLInputElement>('input[placeholder="e.g. Dissertation"]')!;
    const create = [...document.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent === "Create")!;
    expect(create.disabled).toBe(true);

    await act(async () => setInputValue(input, "   "));
    expect(create.disabled).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("trims a valid submission, sends it once, and reports the created folder", async () => {
    const onCreated = vi.fn();
    const onClose = vi.fn();
    let resolveRequest!: (value: Response) => void;
    vi.mocked(fetch).mockReturnValue(new Promise((resolve) => { resolveRequest = resolve; }));
    await renderModal({ onCreated, onClose });
    const input = document.querySelector<HTMLInputElement>('input[placeholder="e.g. Dissertation"]')!;
    await act(async () => setInputValue(input, "  Dissertation  "));

    const form = input.closest("form")!;
    await act(async () => {
      form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
      form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("/api/folders", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ name: "Dissertation" }),
    }));

    await act(async () => resolveRequest(Response.json({ data: { id: "folder-id", name: "Dissertation" } })));
    expect(onCreated).toHaveBeenCalledWith({ id: "folder-id", name: "Dissertation" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the modal and entered name available after a failed request", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json(
      { error: { message: "The folder could not be created." } },
      { status: 500 },
    ));
    const onClose = vi.fn();
    await renderModal({ onClose });
    const input = document.querySelector<HTMLInputElement>('input[placeholder="e.g. Dissertation"]')!;
    await act(async () => setInputValue(input, "Work"));
    await act(async () => {
      input.closest("form")!.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(onClose).not.toHaveBeenCalled();
    expect(input.value).toBe("Work");
    expect(document.body.textContent).toContain("The folder could not be created.");
    expect(showNotification).toHaveBeenCalledWith(expect.objectContaining({ color: "red" }));
  });

  it("resets the name when reopened", async () => {
    const onClose = vi.fn();
    await renderModal({ onClose });
    let input = document.querySelector<HTMLInputElement>('input[placeholder="e.g. Dissertation"]')!;
    await act(async () => setInputValue(input, "Temporary name"));

    await act(async () => {
      root.render(
        <MantineProvider>{null}</MantineProvider>,
      );
      await new Promise((resolve) => setTimeout(resolve, 250));
    });
    await act(async () => {
      root.render(
        <MantineProvider>
          <CreateFolderModal opened onClose={onClose} onCreated={vi.fn()} />
        </MantineProvider>,
      );
      await new Promise((resolve) => setTimeout(resolve, 250));
    });

    input = [...document.querySelectorAll<HTMLInputElement>('input[placeholder="e.g. Dissertation"]')].at(-1)!;
    expect(input.value).toBe("");
  });
});
