import { getSessionFromCookie } from "@/lib/auth/session";
import { fail, ok } from "@/lib/http/responses";

export async function GET() {
  const session = await getSessionFromCookie();
  if (!session) {
    return fail("Unauthorized", 401);
  }

  return ok({
    profileId: session.profileId,
    email: session.email,
  });
}
