import { randomUUID } from "node:crypto";
import { registerSchema } from "@/lib/validation/auth";
import { fail, ok } from "@/lib/http/responses";
import { hashPassword } from "@/lib/auth/password";
import { createAuthSession, createProfile, findProfileByEmail } from "@/lib/db/auth-repo";
import { SESSION_TTL_SECONDS } from "@/lib/auth/constants";
import { setAuthCookie } from "@/lib/auth/session";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    const flatten = parsed.error.flatten();
    const firstFieldError = Object.values(flatten.fieldErrors).find(
      (messages): messages is string[] => Array.isArray(messages) && messages.length > 0,
    )?.[0];

    return fail(firstFieldError ?? "Date invalide pentru inregistrare.", 400, flatten);
  }

  const { email, password, displayName } = parsed.data;
  let existing;
  try {
    existing = await findProfileByEmail(email);
  } catch (error) {
    console.error("Profile lookup failed during registration.", error);
    return fail("Serviciul de autentificare nu este disponibil momentan.", 503);
  }

  if (existing) {
    return fail("Email deja folosit.", 409);
  }

  const passwordHash = await hashPassword(password);
  const profile = await createProfile({ email, passwordHash, displayName });

  const tokenJti = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  await createAuthSession({ profileId: profile.id, tokenJti, expiresAt });
  await setAuthCookie({ sub: profile.id, email: profile.email, jti: tokenJti });

  return ok({ profile });
}
