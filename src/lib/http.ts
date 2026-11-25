import { NextResponse } from "next/server";

export function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json({ error: message, ...(code ? { code } : {}) }, { status });
}

/**
 * 상태를 바꾸는 요청이 같은 사이트에서 왔는지 확인한다 (CSRF 방지 보조 수단, 세션 쿠키는 SameSite=Lax).
 * Origin 헤더가 없으면(일부 비브라우저 요청) 거부한다.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
