import { describe, expect, it } from "vitest";
import {
  DEFAULT_AVATAR_COLORS,
  chooseInitialAvatarColor,
  getAvatarForeground,
  getProfileInitials,
  isValidAvatarColor,
  normalizeAvatarColor,
} from "./identity";

describe("profile identity", () => {
  it.each([
    ["Test", "T"],
    ["Gabriel Ionita", "GI"],
    ["Ionita Gabriel", "IG"],
    ["Gabriel Andrei Ionita", "GI"],
    ["   Gabriel    Ionita   ", "GI"],
  ])("derives initials from %j", (name, expected) => {
    expect(getProfileInitials(name)).toBe(expected);
  });

  it("falls back safely to email and then U", () => {
    expect(getProfileInitials("  ", " gabriel@example.com")).toBe("G");
    expect(getProfileInitials(null, null)).toBe("U");
  });

  it.each(["#228BE6", "#7c3aed"])("accepts valid six-digit HEX %s", (color) => {
    expect(isValidAvatarColor(color)).toBe(true);
  });

  it.each(["red", "123456", "#123", "#12345678", "#ZZZZZZ"])("rejects invalid color %s", (color) => {
    expect(normalizeAvatarColor(color)).toBeNull();
  });

  it("normalizes valid HEX to uppercase", () => {
    expect(normalizeAvatarColor(" #7c3aed ")).toBe("#7C3AED");
  });

  it.each([["#FFFFFF", "#1A1B1E"], ["#F8F9FA", "#1A1B1E"], ["#000000", "#FFFFFF"], ["#364FC7", "#FFFFFF"]])(
    "chooses readable foreground for %s", (color, expected) => expect(getAvatarForeground(color)).toBe(expected),
  );

  it("chooses initial colors only from the curated palette", () => {
    expect(chooseInitialAvatarColor(() => 0)).toBe(DEFAULT_AVATAR_COLORS[0]);
    expect(chooseInitialAvatarColor(() => 0.999)).toBe(DEFAULT_AVATAR_COLORS.at(-1));
  });
});
