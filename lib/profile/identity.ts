export const DEFAULT_AVATAR_COLORS = [
  "#228BE6",
  "#15AABF",
  "#12B886",
  "#40C057",
  "#F59F00",
  "#E8590C",
  "#E64980",
  "#7950F2",
] as const;

const AVATAR_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export function getProfileInitials(displayName?: string | null, email?: string | null) {
  const words = displayName?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (words.length > 0) {
    const initials = words.length === 1
      ? words[0].charAt(0)
      : `${words[0].charAt(0)}${words.at(-1)?.charAt(0) ?? ""}`;
    if (initials.trim()) return initials.toLocaleUpperCase();
  }

  const emailFallback = email?.trim().charAt(0);
  return emailFallback ? emailFallback.toLocaleUpperCase() : "U";
}

export function isValidAvatarColor(value: string): boolean {
  return AVATAR_COLOR_PATTERN.test(value);
}

export function normalizeAvatarColor(value: string): string | null {
  const trimmed = value.trim();
  return isValidAvatarColor(trimmed) ? trimmed.toUpperCase() : null;
}

export function chooseInitialAvatarColor(random = Math.random): (typeof DEFAULT_AVATAR_COLORS)[number] {
  const index = Math.min(Math.floor(random() * DEFAULT_AVATAR_COLORS.length), DEFAULT_AVATAR_COLORS.length - 1);
  return DEFAULT_AVATAR_COLORS[Math.max(0, index)];
}

function linearRgb(channel: number) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function getAvatarForeground(color: string): "#FFFFFF" | "#1A1B1E" {
  const normalized = normalizeAvatarColor(color);
  if (!normalized) return "#1A1B1E";
  const red = linearRgb(Number.parseInt(normalized.slice(1, 3), 16));
  const green = linearRgb(Number.parseInt(normalized.slice(3, 5), 16));
  const blue = linearRgb(Number.parseInt(normalized.slice(5, 7), 16));
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return luminance > 0.179 ? "#1A1B1E" : "#FFFFFF";
}

export type SafeProfile = {
  id: string;
  email: string;
  displayName: string;
  avatarPath: string | null;
  avatarColor: string;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
};
