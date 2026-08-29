import { notFound } from "next/navigation";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { getSessionFromCookie } from "@/lib/auth/session";
import { findSafeProfileById } from "@/lib/db/profile-repo";

export default async function ProfilePage() {
  const session = await getSessionFromCookie();
  if (!session) return null;
  const profile = await findSafeProfileById(session.profileId);
  if (!profile) notFound();
  return <ProfileEditor profile={profile} />;
}
