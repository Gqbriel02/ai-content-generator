import { ChatShell } from "@/components/chat/chat-shell";
import { getSessionFromCookie } from "@/lib/auth/session";
import { findSafeProfileById } from "@/lib/db/profile-repo";
import { withProfileAvatarUrl } from "@/lib/profile/profile-view";

export default async function ChatPage(props: PageProps<"/chat/[chatId]">) {
  const { chatId } = await props.params;
  const session = await getSessionFromCookie();
  const profile = session ? await findSafeProfileById(session.profileId) : undefined;
  return <ChatShell chatId={chatId} profile={profile ? await withProfileAvatarUrl(profile) : undefined} />;
}
