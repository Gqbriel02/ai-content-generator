import { Avatar } from "@mantine/core";
import { getAvatarForeground, getProfileInitials } from "@/lib/profile/identity";

type ProfileAvatarProps = {
  displayName?: string | null;
  email?: string | null;
  avatarColor: string;
  size?: number | string;
};

export function ProfileAvatar({ displayName, email, avatarColor, size = 36 }: ProfileAvatarProps) {
  return (
    <Avatar
      size={size}
      radius="xl"
      color="initials"
      styles={{ root: { backgroundColor: avatarColor, color: getAvatarForeground(avatarColor), fontWeight: 700 } }}
    >
      {getProfileInitials(displayName, email)}
    </Avatar>
  );
}
