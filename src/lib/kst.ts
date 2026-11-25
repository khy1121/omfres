// 한국 시간(KST) 표시 도우미. 저장은 ISO(UTC), 표시만 KST로 한다.

const dateFmt = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" });
const partsFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "numeric" });

/** "2026년 11월 25일" */
export function fmtKstDate(isoString: string | null | undefined): string {
  if (!isoString) return "";
  const d = new Date(isoString);
  return Number.isFinite(d.getTime()) ? dateFmt.format(d) : "";
}

/** KST 기준 오늘 "YYYY-MM-DD" */
export function kstToday(now = Date.now()): string {
  return new Date(now + 9 * 3600_000).toISOString().slice(0, 10);
}

/** KST 기준 현재 연·월 */
export function kstYearMonth(now = new Date()): { year: number; month: number } {
  const parts = partsFmt.formatToParts(now);
  return { year: Number(parts.find((p) => p.type === "year")!.value), month: Number(parts.find((p) => p.type === "month")!.value) };
}
