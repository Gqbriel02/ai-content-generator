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
  });

  it("centers generated assistant images within a responsive maximum display box", async () => {
    await act(async () => root.render(
      <MantineProvider><MessageCard message={{
        role: "assistant", content_text: "", generation_type: "image", image_alt: "Generated result",
        attachments: [{ storagePath: "generated/result.webp", mimeType: "image/webp", signedUrl: "signed-url" }],
      }} /></MantineProvider>,
    ));

    const image = document.querySelector('img[alt="Generated result"]') as HTMLImageElement;
    expect(image.style.width).toBe("auto");
    expect(image.style.height).toBe("auto");
    expect(image.style.maxWidth).toBe("min(100%, 620px)");
    expect(image.style.maxHeight).toBe("520px");
    expect(image.style.objectFit).toBe("contain");
    expect(image.parentElement?.className).toContain("mantine-Group-root");
    expect(image.parentElement?.style.getPropertyValue("--group-justify")).toBe("center");
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
