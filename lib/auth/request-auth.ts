import { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { verifySessionToken } from "@/lib/auth/jwt";

export async function readRequestSession(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  try {
    const payload = await verifySessionToken(token);
    return {
      profileId: payload.sub,
      email: payload.email,
      tokenJti: payload.jti,
    };
  } catch {
    return null;
  }
}
