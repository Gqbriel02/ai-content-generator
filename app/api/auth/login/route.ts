import { randomUUID } from "node:crypto";
import { loginSchema } from "@/lib/validation/auth";
import { fail, ok } from "@/lib/http/responses";
import { verifyPassword } from "@/lib/auth/password";
import { createAuthSession, findProfileByEmail } from "@/lib/db/auth-repo";
import { SESSION_TTL_SECONDS } from "@/lib/auth/constants";
import { setAuthCookie } from "@/lib/auth/session";
import { hitRateLimit } from "@/lib/http/rate-limit";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Date invalide pentru login.", 400, parsed.error.flatten());
  }

  const limiterKey = `login:${parsed.data.email.toLowerCase()}`;
  if (hitRateLimit(limiterKey, 12)) {
    return fail("Prea multe incercari. Incearca din nou intr-un minut.", 429);
  }

  const profile = await findProfileByEmail(parsed.data.email);
  if (!profile) {
    return fail("Credentiale invalide.", 401);
  }

  const isValid = await verifyPassword(parsed.data.password, profile.password_hash);
  if (!isValid) {
    return fail("Credentiale invalide.", 401);
  }

  const tokenJti = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  await createAuthSession({ profileId: profile.id, tokenJti, expiresAt });
  await setAuthCookie({ sub: profile.id, email: profile.email, jti: tokenJti });

  return ok({
    profile: { id: profile.id, email: profile.email, displayName: profile.display_name },
  });
}
