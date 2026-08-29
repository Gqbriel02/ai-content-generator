import { ChatShell } from "@/components/chat/chat-shell";
import { getSessionFromCookie } from "@/lib/auth/session";
import { findSafeProfileById } from "@/lib/db/profile-repo";
import { withProfileAvatarUrl } from "@/lib/profile/profile-view";

export default async function ChatIndexPage() {
  const session = await getSessionFromCookie();
  const profile = session ? await findSafeProfileById(session.profileId) : undefined;
  return <ChatShell profile={profile ? await withProfileAvatarUrl(profile) : undefined} />;
}
