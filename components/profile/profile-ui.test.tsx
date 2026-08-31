// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/chat", useParams: () => ({}) }));

import { ChatShell } from "@/components/chat/chat-shell";
import { ProfileEditor } from "./profile-editor";
import { ProfileAvatar } from "./profile-avatar";

const profile = { id: "owner", email: "gabriel@example.com", displayName: "Gabriel Ionita", avatarPath: null,
  avatarColor: "#228BE6", createdAt: "2026-08-05T00:00:00Z", updatedAt: "2026-08-05T00:00:00Z" };
const profileWithAvatar = { ...profile, avatarPath: "owner/avatar/photo.webp", avatarUrl: "https://private.example/photo" };

function modalButton(name: string) {
  return Array.from(document.querySelectorAll(".mantine-Modal-root button")).find((element) => element.textContent?.trim() === name) as HTMLButtonElement;
}

async function openRemovePhotoModal() {
  await act(async () => {
    const trigger = document.querySelector('[data-testid="open-remove-photo-modal"]') as HTMLButtonElement;
    trigger.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    trigger.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    trigger.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 250));
  });
}

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

  it("renders the compact account-first hierarchy with a sticky full-page background", async () => {
    vi.stubGlobal("fetch", vi.fn());
    await act(async () => { root.render(<MantineProvider><ProfileEditor profile={profile} /></MantineProvider>); });
    const account = document.querySelector('[data-testid="account-information-card"]') as HTMLElement;
    const appearance = document.querySelector('[data-testid="profile-appearance-card"]') as HTMLElement;
    expect(account.compareDocumentPosition(appearance) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(document.querySelectorAll(".mantine-Avatar-root")).toHaveLength(1);
    expect(Array.from(document.querySelectorAll("h1,h2,h3")).filter((heading) => heading.textContent === "Profile")).toHaveLength(1);
    expect(document.body.textContent).not.toContain("Manage your profile photo and the fallback color used behind your initials.");
    expect(Array.from(document.querySelectorAll("h1,h2,h3,h4")).some((heading) => heading.textContent === "Profile photo")).toBe(false);
    expect(document.body.textContent).toContain("JPEG, PNG, or WebP. Maximum 5 MB.");
    const stickyHeader = document.querySelector('[data-testid="profile-sticky-header"]') as HTMLElement;
    expect(stickyHeader.style.position).toBe("sticky"); expect(stickyHeader.style.top).toBe("0rem");
    const page = document.querySelector('[data-testid="profile-page-background"]') as HTMLElement;
    expect(page.style.backgroundColor).toBe("rgb(248, 251, 255)"); expect(page.style.minHeight).toBe("100dvh");
    const danger = document.querySelector('[data-testid="danger-zone-card"]') as HTMLElement;
    expect(appearance.compareDocumentPosition(danger) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(document.body.textContent).toContain("Danger zone"); expect(document.body.textContent).toContain("Logout");
  });

  it("falls back to initials when the browser cannot load a signed avatar image", async () => {
    await act(async () => { root.render(<MantineProvider><ProfileAvatar displayName="Gabriel Ionita" email="gabriel@example.com"
      avatarColor="#7950F2" avatarUrl="https://private.example/signed" /></MantineProvider>); });
    const image = document.querySelector("img") as HTMLImageElement;
    expect(image.src).toBe("https://private.example/signed");
    await act(async () => image.dispatchEvent(new Event("error")));
    expect(document.querySelector("img")).toBeNull();
    expect(document.body.textContent).toContain("GI");
  });

  it("keeps a selected photo local until explicit Save photo and revokes the preview", async () => {
    const createObjectURL = vi.fn(() => "blob:local-avatar"); const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ data: { ...profile, avatarPath: "owner/avatar/new.png", avatarUrl: "https://private.example/new" } }, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    await act(async () => { root.render(<MantineProvider><ProfileEditor profile={profile} /></MantineProvider>); });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])], "mine.png", { type: "image/png" });
    Object.defineProperty(input, "files", { configurable: true, value: [file] });
    await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); await Promise.resolve(); });
    expect(createObjectURL).toHaveBeenCalledWith(file); expect(fetchMock).not.toHaveBeenCalled();
    expect((document.querySelector('img[src="blob:local-avatar"]') as HTMLImageElement)).not.toBeNull();
    const savePhoto = Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("Save photo")) as HTMLButtonElement;
    await act(async () => { savePhoto.click(); await new Promise((resolve) => setTimeout(resolve, 10)); });
    expect(fetchMock).toHaveBeenCalledWith("/api/profile/avatar", expect.objectContaining({ method: "POST", body: expect.any(FormData) }));
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:local-avatar");
  });

  it("requires modal confirmation before removing a profile photo and Cancel makes no request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await act(async () => { root.render(<MantineProvider><ProfileEditor profile={profileWithAvatar} /></MantineProvider>); await new Promise((resolve) => setTimeout(resolve, 20)); });

    await openRemovePhotoModal();
    expect(document.body.textContent).toContain("Remove profile photo?");
    expect(document.body.textContent).toContain("Are you sure you want to remove your profile photo? Your initials and fallback color will be shown instead.");
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => { modalButton("Cancel").click(); await new Promise((resolve) => setTimeout(resolve, 400)); });
    expect(document.body.textContent).not.toContain("Remove profile photo?");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(document.querySelector('img[src="https://private.example/photo"]')).not.toBeNull();
  });

  it("dismisses the remove-photo modal with its close button without deleting", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await act(async () => { root.render(<MantineProvider><ProfileEditor profile={profileWithAvatar} /></MantineProvider>); await new Promise((resolve) => setTimeout(resolve, 20)); });
    await openRemovePhotoModal();
    const close = document.querySelector('.mantine-Modal-close') as HTMLButtonElement;
    await act(async () => { close.click(); await new Promise((resolve) => setTimeout(resolve, 400)); });
    expect(document.body.textContent).not.toContain("Remove profile photo?");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("runs one DELETE only after confirmation, locks duplicate submission, and preserves the fallback color", async () => {
    let resolveRemoval!: (response: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { resolveRemoval = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    await act(async () => { root.render(<MantineProvider><ProfileEditor profile={profileWithAvatar} /></MantineProvider>); await new Promise((resolve) => setTimeout(resolve, 20)); });
    await openRemovePhotoModal();
    const confirm = modalButton("Remove photo");
    await act(async () => { confirm.click(); confirm.click(); await Promise.resolve(); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/profile/avatar", { method: "DELETE" });
    expect(confirm.disabled).toBe(true);
    expect(modalButton("Cancel").disabled).toBe(true);

    await act(async () => { resolveRemoval(Response.json({ data: { ...profile, avatarUrl: null } })); await new Promise((resolve) => setTimeout(resolve, 400)); });
    expect(document.body.textContent).not.toContain("Remove profile photo?");
    expect(document.querySelector('img[src="https://private.example/photo"]')).toBeNull();
    expect(document.body.textContent).toContain("GI");
    expect((document.querySelector(".mantine-Avatar-root") as HTMLElement).style.backgroundColor).toBe("rgb(34, 139, 230)");
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("keeps the photo and modal available for retry when removal fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ error: { message: "Removal failed." } }, { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    await act(async () => { root.render(<MantineProvider><ProfileEditor profile={profileWithAvatar} /></MantineProvider>); await new Promise((resolve) => setTimeout(resolve, 20)); });
    await openRemovePhotoModal();
    await act(async () => { modalButton("Remove photo").click(); await new Promise((resolve) => setTimeout(resolve, 10)); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain("Remove profile photo?");
    expect(document.querySelector('img[src="https://private.example/photo"]')).not.toBeNull();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("logs out from the sticky header without invoking account deletion", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ data: { success: true } }));
    vi.stubGlobal("fetch", fetchMock);
    await act(async () => { root.render(<MantineProvider><ProfileEditor profile={profile} /></MantineProvider>); await new Promise((resolve) => setTimeout(resolve, 20)); });
    const logout = Array.from(document.querySelectorAll("button")).find((item) => item.textContent?.trim() === "Logout") as HTMLButtonElement;
    await act(async () => { logout.click(); await new Promise((resolve) => setTimeout(resolve, 10)); });
    expect(fetchMock).toHaveBeenCalledOnce(); expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" });
    expect(fetchMock).not.toHaveBeenCalledWith("/api/profile", expect.objectContaining({ method: "DELETE" }));
    expect(router.push).toHaveBeenCalledWith("/login"); expect(router.refresh).toHaveBeenCalledOnce();
  });

  it("opens account confirmation without deleting and sends one DELETE only after valid confirmation", async () => {
    let resolveDelete!: (response: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { resolveDelete = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    await act(async () => { root.render(<MantineProvider><ProfileEditor profile={profile} /></MantineProvider>); await new Promise((resolve) => setTimeout(resolve, 20)); });
    const trigger = Array.from(document.querySelectorAll("button")).find((item) => item.textContent?.trim() === "Delete account") as HTMLButtonElement;
    await act(async () => { trigger.click(); await new Promise((resolve) => setTimeout(resolve, 250)); });
    expect(fetchMock).not.toHaveBeenCalled();
    const checkbox = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
    const input = document.querySelector('input[placeholder="DELETE"]') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => checkbox.click());
    await act(async () => { setter?.call(input, "DELETE"); input.dispatchEvent(new Event("input", { bubbles: true })); });
    const confirm = Array.from(document.querySelectorAll(".mantine-Modal-root button")).find((item) => item.textContent?.trim() === "Delete account") as HTMLButtonElement;
    await act(async () => { confirm.click(); confirm.click(); await Promise.resolve(); });
    expect(fetchMock).toHaveBeenCalledTimes(1); expect(fetchMock).toHaveBeenCalledWith("/api/profile", { method: "DELETE" });
    expect(confirm.disabled).toBe(true);
    await act(async () => { resolveDelete(Response.json({ data: { success: true } })); await new Promise((resolve) => setTimeout(resolve, 10)); });
    expect(router.replace).toHaveBeenCalledWith("/login"); expect(router.refresh).toHaveBeenCalledOnce();
  });

  it("keeps account deletion modal usable and does not redirect after a failed request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ error: { message: "Could not delete your account. Please try again." } }, { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    await act(async () => { root.render(<MantineProvider><ProfileEditor profile={profile} /></MantineProvider>); await new Promise((resolve) => setTimeout(resolve, 20)); });
    const trigger = Array.from(document.querySelectorAll("button")).find((item) => item.textContent?.trim() === "Delete account") as HTMLButtonElement;
    await act(async () => { trigger.click(); await new Promise((resolve) => setTimeout(resolve, 250)); });
    const checkbox = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
    const input = document.querySelector('input[placeholder="DELETE"]') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => checkbox.click()); await act(async () => { setter?.call(input, "DELETE"); input.dispatchEvent(new Event("input", { bubbles: true })); });
    const confirm = Array.from(document.querySelectorAll(".mantine-Modal-root button")).find((item) => item.textContent?.trim() === "Delete account") as HTMLButtonElement;
    await act(async () => { confirm.click(); await new Promise((resolve) => setTimeout(resolve, 10)); });
    expect(router.replace).not.toHaveBeenCalled(); expect(document.body.textContent).toContain("Delete account?"); expect(confirm.disabled).toBe(false);
  });
});
