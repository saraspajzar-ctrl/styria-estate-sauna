import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "styria_stay_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set.");
  return new TextEncoder().encode(secret);
}

export type GuestSessionPayload = {
  stayId: string;
};

/**
 * The guest session cookie carries ONLY the stay id, signed server-side.
 * Every guest API route trusts this cookie — never a client-supplied stay
 * id in a URL or request body — so a guest cannot access another stay by
 * editing a request.
 */
export async function createGuestSession(stayId: string) {
  const token = await new SignJWT({ stayId } satisfies GuestSessionPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function getGuestSession(): Promise<GuestSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (typeof payload.stayId !== "string") return null;
    return { stayId: payload.stayId };
  } catch {
    return null;
  }
}

export async function clearGuestSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
