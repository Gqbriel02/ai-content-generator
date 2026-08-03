import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/config/env";
import { SESSION_TTL_SECONDS } from "@/lib/auth/constants";

export type SessionPayload = {
  sub: string;
  email: string;
  jti: string;
};

const secret = new TextEncoder().encode(env.JWT_SECRET);

export async function signSession(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setJti(payload.jti)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret);
}

export async function verifySessionToken(token: string) {
  const { payload } = await jwtVerify<SessionPayload>(token, secret);
  return payload;
}
