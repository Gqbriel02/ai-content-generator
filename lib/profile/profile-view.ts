import type { SafeProfile } from "@/lib/profile/identity";
import { createProfileAvatarSignedUrl } from "@/lib/storage/profile-avatar";

export async function withProfileAvatarUrl(profile: SafeProfile): Promise<SafeProfile> {
  if (!profile.avatarPath) return { ...profile, avatarUrl: null };
  try {
    return { ...profile, avatarUrl: await createProfileAvatarSignedUrl(profile.id, profile.avatarPath) };
  } catch (error) {
    console.warn("Profile avatar is unavailable; using initials fallback.", error);
    return { ...profile, avatarUrl: null };
  }
}
