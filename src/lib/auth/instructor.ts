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

export function instructorDomains(): string[] {
  return parseDomains(process.env.INSTRUCTOR_EMAIL_DOMAINS);
}
