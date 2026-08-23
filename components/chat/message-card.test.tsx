// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MessageCard } from "./message-card";

describe("MessageCard", () => {
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
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("renders a pending assistant with its captured mode and an accessible loader", async () => {
    await act(async () => root.render(
      <MantineProvider><MessageCard pendingStatus="loading"
        message={{ role: "assistant", content_text: "", answer_mode: "tutorial" }} />
      </MantineProvider>,
    ));
    expect(document.body.textContent).toContain("assistant");
    expect(document.body.textContent).toContain("Step-by-Step");
    expect(document.querySelector('[role="status"]')?.textContent).toContain("Loading...");
  });

  it("renders submitted user content and attachment from local state", async () => {
    await act(async () => root.render(
      <MantineProvider><MessageCard message={{
        role: "user", content_text: "Pending prompt",
        attachments: [{ storagePath: "owner/image.png", mimeType: "image/png", signedUrl: "preview-url" }],
      }} /></MantineProvider>,
    ));
    expect(document.body.textContent).toContain("Pending prompt");
    const image = document.querySelector('img[alt="Attachment"]') as HTMLImageElement;
    expect(image.getAttribute("src")).toBe("preview-url");
    expect(image.style.width).toBe("150px");
    expect(image.style.maxWidth).toBe("100%");
    expect(image.style.maxHeight).toBe("");
    image.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("keeps generated images compact and opens and closes the enlarged viewer", async () => {
    await act(async () => root.render(
      <MantineProvider><MessageCard message={{
        role: "assistant", content_text: "", generation_type: "image", image_alt: "Generated result",
        attachments: [{ id: "attachment-id", storagePath: "generated/result.webp", mimeType: "image/webp", signedUrl: "signed-url" }],
      }} /></MantineProvider>,
    ));

    const openButton = document.querySelector('button[aria-label="View generated image"]') as HTMLButtonElement;
    const image = openButton.querySelector("img") as HTMLImageElement;
    expect(image.style.width).toBe("auto");
    expect(image.style.height).toBe("auto");
    expect(image.style.maxWidth).toBe("min(100%, 520px)");
    expect(image.style.maxHeight).toBe("320px");
    expect(image.style.objectFit).toBe("contain");
    expect(openButton.style.cursor).toBe("zoom-in");

    await act(async () => openButton.click());
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.querySelectorAll('img[alt="Generated result"]')).toHaveLength(2);
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    const header = dialog.querySelector("header") as HTMLElement;
    const downloadButtons = [...dialog.querySelectorAll("button")]
      .filter((button) => button.textContent?.includes("Download"));
    expect(header.textContent).toContain("Generated image");
    expect(header.contains(downloadButtons[0])).toBe(true);
    expect(downloadButtons).toHaveLength(1);
    expect(header.querySelector('button[aria-label="Close image viewer"]')).not.toBeNull();
    expect(dialog.querySelector(".mantine-Modal-body")?.textContent).not.toContain("Download");

    const closeButton = document.querySelector('button[aria-label="Close image viewer"]') as HTMLButtonElement;
    await act(async () => closeButton.click());
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("reuses the authoritative generated attachment and closes the viewer", async () => {
    const onReuse = vi.fn();
    await act(async () => root.render(
      <MantineProvider><MessageCard onReuseGeneratedImage={onReuse} message={{
        role: "assistant", content_text: "", generation_type: "image",
        attachments: [{ id: "attachment-id", storagePath: "generated/result.webp", mimeType: "image/webp", signedUrl: "signed-url" }],
      }} /></MantineProvider>,
    ));
    await act(async () => (document.querySelector('button[aria-label="View generated image"]') as HTMLButtonElement).click());
    const reuse = [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Reuse")) as HTMLButtonElement;
    expect(reuse.closest("header")).not.toBeNull();
    await act(async () => reuse.click());
    expect(onReuse).toHaveBeenCalledWith({ attachmentId: "attachment-id", previewUrl: "signed-url", mimeType: "image/webp" });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("replaces loading with a non-cancellation failure state", async () => {
    await act(async () => root.render(
      <MantineProvider><MessageCard pendingStatus="error"
        message={{ role: "assistant", content_text: "", answer_mode: "standard" }} />
      </MantineProvider>,
    ));
    expect(document.body.textContent).toContain("Generation failed. Please try again.");
    expect(document.body.textContent).not.toContain("Loading...");
    expect(document.body.textContent?.toLowerCase()).not.toContain("cancel");
  });
});
