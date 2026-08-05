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
    return fail("Invalid sign-in details.", 400, parsed.error.flatten());
  }

  const limiterKey = `login:${parsed.data.email.toLowerCase()}`;
  if (hitRateLimit(limiterKey, 12)) {
    return fail("Too many sign-in attempts. Please try again in one minute.", 429);
  }

  let profile;
  try {
    profile = await findProfileByEmail(parsed.data.email);
  } catch (error) {
    console.error("Profile lookup failed during login.", error);
    return fail("The authentication service is temporarily unavailable. Please try again.", 503);
  }

  if (!profile) {
    return fail("Invalid email or password.", 401);
  }

  const isValid = await verifyPassword(parsed.data.password, profile.password_hash);
  if (!isValid) {
    return fail("Invalid email or password.", 401);
  }

  const tokenJti = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  await createAuthSession({ profileId: profile.id, tokenJti, expiresAt });
  await setAuthCookie({ sub: profile.id, email: profile.email, jti: tokenJti });

  return ok({
    profile: { id: profile.id, email: profile.email, displayName: profile.display_name },
  });
}
