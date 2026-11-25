import { NextResponse } from "next/server";
import { endSession, startSession } from "@/lib/session";
import { ensureUserDoc } from "@/lib/dal/user";
import { isSameOrigin, jsonError } from "@/lib/http";

/** 로그인: 브라우저가 Google 로그인으로 받은 ID 토큰을 세션 쿠키로 바꾼다 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("허용되지 않은 요청입니다.", 403);
  const body = (await request.json().catch(() => null)) as { idToken?: unknown; displayName?: unknown } | null;
  if (typeof body?.idToken !== "string" || !body.idToken) return jsonError("로그인 정보가 없습니다.", 400);

  const claims = await startSession(body.idToken);
  if (!claims) return jsonError("로그인 정보를 확인하지 못했습니다. 다시 로그인해주세요.", 401);

  await ensureUserDoc(claims, typeof body.displayName === "string" ? body.displayName : null);
  return NextResponse.json({ ok: true });
}

/** 로그아웃 */
export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return jsonError("허용되지 않은 요청입니다.", 403);
  await endSession();
  return NextResponse.json({ ok: true });
}
