/** 로그인 후 돌아갈 경로. 같은 사이트의 절대 경로만 허용한다 (외부 주소로 보내는 오픈 리다이렉트 방지). */
export function safeNextPath(raw: unknown, fallback = "/"): string {
  if (typeof raw !== "string") return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(raw)) return fallback;
  return raw;
}
