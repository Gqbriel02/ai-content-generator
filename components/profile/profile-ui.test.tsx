// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/chat", useParams: () => ({}) }));

import { ChatShell } from "@/components/chat/chat-shell";
import { ProfileEditor } from "./profile-editor";

const profile = { id: "owner", email: "gabriel@example.com", displayName: "Gabriel Ionita", avatarPath: null,
  avatarColor: "#228BE6", createdAt: "2026-08-05T00:00:00Z", updatedAt: "2026-08-05T00:00:00Z" };

describe("profile UI", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: { addEventListener: vi.fn(), removeEventListener: vi.fn() } });
    Object.defineProperty(document, "fonts", { configurable: true, value: { addEventListener: vi.fn(), removeEventListener: vi.fn() } });
    HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("shows persisted initials and the Profile and Logout menu actions", async () => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      if (["/api/folders", "/api/chats"].includes(String(input))) return Promise.resolve(Response.json({ data: [] }));
      throw new Error(`Unexpected fetch: ${input}`);
    }));
    await act(async () => { root.render(<MantineProvider><ChatShell profile={profile} /></MantineProvider>); await new Promise((resolve) => setTimeout(resolve, 20)); });
    const trigger = document.querySelector('button[aria-label="Open profile menu"]') as HTMLButtonElement;
    expect(trigger.textContent).toContain("GI");
    expect(trigger.innerHTML).toContain("rgb(34, 139, 230)");
    await act(async () => {
      trigger.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    expect(document.body.textContent).toContain("Profile");
    expect(document.body.textContent).toContain("Logout");
  });

  it("previews locally, normalizes, and saves explicitly", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ data: { ...profile, avatarColor: "#7950F2" } }));
    vi.stubGlobal("fetch", fetchMock);
    await act(async () => { root.render(<MantineProvider><ProfileEditor profile={profile} /></MantineProvider>); });
    expect(document.body.textContent).toContain("Back to chats");
    expect(document.body.textContent).toContain("Member since");
    expect(document.body.textContent).not.toContain("password_hash");
    const input = Array.from(document.querySelectorAll("input")).find((element) => element.value === "#228BE6") as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => { setter?.call(input, "#7950f2"); input.dispatchEvent(new Event("input", { bubbles: true })); await Promise.resolve(); });
    const save = Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("Save changes")) as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    await act(async () => { save.click(); await new Promise((resolve) => setTimeout(resolve, 10)); });
    expect(fetchMock).toHaveBeenCalledWith("/api/profile", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ avatarColor: "#7950F2" }) }));
    expect(save.disabled).toBe(true);
    expect(router.refresh).toHaveBeenCalled();
  });
});
