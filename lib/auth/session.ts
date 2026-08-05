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

export async function getSessionFromToken(rawToken: string) {
  let payload;
  try {
    payload = await verifySessionToken(rawToken);
  } catch {
    return null;
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("auth_sessions")
    .select("profile_id, revoked_at, expires_at")
    .eq("token_jti", payload.jti)
    .maybeSingle();

  if (error) throw error;
  if (!data || data.revoked_at !== null || data.profile_id !== payload.sub) {
    return null;
  }

  const expiresAt = Date.parse(data.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return null;
  }

  return {
    profileId: data.profile_id,
    email: payload.email,
    tokenJti: payload.jti,
  };
}

export async function getSessionFromCookie() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  return rawToken ? getSessionFromToken(rawToken) : null;
}
