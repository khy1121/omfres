export const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function fmtDate(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const w = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${y}년 ${m}월 ${d}일 (${w})`;
}

export function addMinutes(time: string, min: number) {
  const [h, m] = time.split(":").map(Number);
  const t = h * 60 + m + min;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}
