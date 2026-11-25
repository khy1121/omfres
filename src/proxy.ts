import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-cookie";

// 낙관적 검사만 한다: 세션 쿠키가 없으면 로그인 화면으로 보낸다.
// 쿠키가 유효한지와 권한은 각 화면·API의 DAL에서 다시 검증한다.
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  const url = new URL("/login", request.url);
  url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/me/:path*", "/courses/:path*", "/join/:path*", "/bookings/:path*"],
};
