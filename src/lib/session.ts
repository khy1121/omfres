import "server-only";
import { cookies } from "next/headers";
import { adminAuth } from "./firebase/admin";

import { SESSION_COOKIE } from "./session-cookie";

const SESSION_DAYS = 7;
/** 로그인 직후 받은 ID 토큰만 세션으로 바꿔준다 (탈취된 오래된 토큰 재사용 방지) */
const MAX_TOKEN_AGE_SEC = 5 * 60;

export type SessionClaims = { uid: string; email: string | null; emailVerified: boolean };

export async function startSession(idToken: string): Promise<SessionClaims | null> {
  const auth = adminAuth();
  let decoded;
  try {
    decoded = await auth.verifyIdToken(idToken, true);
  } catch {
    return null;
  }
  if (Date.now() / 1000 - decoded.auth_time > MAX_TOKEN_AGE_SEC) return null;

  const expiresIn = SESSION_DAYS * 24 * 3600 * 1000;
  const cookie = await auth.createSessionCookie(idToken, { expiresIn });
  (await cookies()).set(SESSION_COOKIE, cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: expiresIn / 1000,
  });
  return { uid: decoded.uid, email: decoded.email ?? null, emailVerified: decoded.email_verified === true };
}

/** 쿠키의 세션을 검증한다. 폐기된 세션(로그아웃·강제 만료)도 거부한다 */
export async function readSession(): Promise<SessionClaims | null> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!value) return null;
  try {
    const d = await adminAuth().verifySessionCookie(value, true);
    return { uid: d.uid, email: d.email ?? null, emailVerified: d.email_verified === true };
  } catch {
    return null;
  }
}

export async function endSession() {
  const store = await cookies();
  const session = await readSession();
  store.delete(SESSION_COOKIE);
  // 다른 기기·탭의 세션도 함께 만료
  if (session) await adminAuth().revokeRefreshTokens(session.uid).catch(() => {});
}
