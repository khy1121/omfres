// 교수 선택 자격 — 확인된 이메일의 도메인이 학교 도메인과 정확히 일치해야 한다 (하위 도메인 불인정).
// 학교 도메인은 학생도 사용하므로 이것만으로 교수가 되지는 않는다. 본인이 '교수'를 선택해야 한다 (profile.ts).

export function parseDomains(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

export function emailDomain(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return null;
  return email.slice(at + 1).trim().toLowerCase();
}

/** 교수를 선택할 수 있는 계정인지 (학교 도메인의 확인된 이메일) */
export function isInstructorEligible(email: string | null | undefined, emailVerified: boolean, domains: string[]): boolean {
  if (!emailVerified) return false;
  const domain = emailDomain(email);
  return domain !== null && domains.includes(domain);
}

let warnedMissing = false;

/**
 * 교수 선택 가능 도메인. 비어 있으면 아무도 교수를 선택할 수 없으므로(안전한 쪽으로 막힘)
 * 설정 누락을 알아챌 수 있도록 서버 로그에 한 번 경고한다.
 */
export function instructorDomains(env: Record<string, string | undefined> = process.env, warn: (msg: string) => void = console.warn): string[] {
  const domains = parseDomains(env.INSTRUCTOR_EMAIL_DOMAINS);
  if (!domains.length && !warnedMissing) {
    warnedMissing = true;
    warn("[auth] INSTRUCTOR_EMAIL_DOMAINS가 비어 있어 아무도 교수 계정을 선택할 수 없습니다. 배포 환경변수를 확인하세요.");
  }
  return domains;
}
