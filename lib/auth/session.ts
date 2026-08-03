import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, SESSION_TTL_SECONDS } from "@/lib/auth/constants";
import { signSession, verifySessionToken } from "@/lib/auth/jwt";
import { createServerSupabaseClient } from "@/lib/db/supabase";

export async function setAuthCookie(payload: { sub: string; email: string; jti: string }) {
  const cookieStore = await cookies();
  const token = await signSession(payload);

  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
}

export async function getSessionFromCookie() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!rawToken) {
    return null;
  }

  try {
    const payload = await verifySessionToken(rawToken);
    const supabase = createServerSupabaseClient();
    const { data } = await supabase
      .from("auth_sessions")
      .select("profile_id, revoked_at, expires_at")
      .eq("token_jti", payload.jti)
      .is("revoked_at", null)
      .maybeSingle();

    if (!data) {
      return null;
    }

    const expired = new Date(data.expires_at).getTime() < Date.now();
    if (expired) {
      return null;
    }

    return {
      profileId: payload.sub,
      email: payload.email,
      tokenJti: payload.jti,
    };
  } catch {
    return null;
  }
}
