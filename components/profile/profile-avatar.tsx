"use client";

import { Avatar } from "@mantine/core";
import { useState } from "react";
import { getAvatarForeground, getProfileInitials } from "@/lib/profile/identity";

type ProfileAvatarProps = {
  displayName?: string | null;
  email?: string | null;
  avatarColor: string;
  avatarUrl?: string | null;
  size?: number | string;
};

export function ProfileAvatar({ displayName, email, avatarColor, avatarUrl, size = 36 }: ProfileAvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const visibleAvatarUrl = avatarUrl && avatarUrl !== failedUrl ? avatarUrl : null;

  return (
    <Avatar
      src={visibleAvatarUrl}
      alt={visibleAvatarUrl ? `${displayName || "Profile"} avatar` : undefined}
      imageProps={{ onError: () => setFailedUrl(avatarUrl ?? null), style: { objectFit: "cover" } }}
      size={size}
      radius="xl"
      color="initials"
      styles={{ root: { backgroundColor: avatarColor, color: getAvatarForeground(avatarColor), fontWeight: 700 } }}
    >
      {getProfileInitials(displayName, email)}
    </Avatar>
  );
}
