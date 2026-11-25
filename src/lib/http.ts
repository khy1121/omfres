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
  // 프록시를 여러 단계 거치면 "a.com, b.com"처럼 값이 이어붙는다. 클라이언트가 요청한 첫 번째 호스트를 쓴다.
  const forwarded = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = (forwarded || request.headers.get("host") || "").toLowerCase();
  if (!host) return false;
  try {
    return new URL(origin).host.toLowerCase() === host;
  } catch {
    return false;
  }
}
