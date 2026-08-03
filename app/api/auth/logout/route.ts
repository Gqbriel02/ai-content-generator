import { clearAuthCookie, getSessionFromCookie } from "@/lib/auth/session";
import { revokeAuthSession } from "@/lib/db/auth-repo";
import { ok } from "@/lib/http/responses";

export async function POST() {
  const session = await getSessionFromCookie();
  if (session) {
    await revokeAuthSession(session.tokenJti);
  }

  await clearAuthCookie();
  return ok({ success: true });
}
