import { getSessionFromCookie } from "@/lib/auth/session";
import { fail } from "@/lib/http/responses";

export async function requireSession() {
  const session = await getSessionFromCookie();
  if (!session) {
    return { error: fail("Unauthorized", 401) } as const;
  }
  return { session } as const;
}
