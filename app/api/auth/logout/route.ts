import { clearAuthCookie, getSessionFromCookie } from "@/lib/auth/session";
import { revokeAuthSession } from "@/lib/db/auth-repo";
import { fail, ok } from "@/lib/http/responses";

export async function POST() {
  try {
    const session = await getSessionFromCookie();
    if (session) {
      await revokeAuthSession(session.tokenJti);
    }
  } catch (error) {
    console.error("Session revocation failed during logout.", error);
    return fail("The server session could not be revoked during sign out. Please try again.", 503);
  } finally {
    await clearAuthCookie();
  }

  return ok({ success: true });
}
