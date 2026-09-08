// 상담 운영 설정 — 필요에 맞게 수정하세요.
export const CONFIG = {
  /** 상담 시작 가능 시간 (24h) */
  startHour: 9,
  /** 마지막 상담 시작 시간의 상한 (이 시각 전까지 시작 가능). 예: 18 → 17:30이 마지막 슬롯 */
  endHour: 18,
  /** 슬롯 간격(분). 상담 1회 최소 30분 */
  slotMinutes: 30,
  /** 예약 가능한 요일 (0=일 ... 6=토) */
  openDays: [1, 2, 3, 4, 5],
  /** 오늘부터 며칠 후까지 예약 가능한지 */
  maxDaysAhead: 60,
  /** 점심시간 등 제외 구간 (HH:MM 시작시간 기준) */
  blockedTimes: ["12:00", "12:30"],
  /** 표시용 타임존 */
  timeZone: "Asia/Seoul",
};

export function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let m = CONFIG.startHour * 60; m < CONFIG.endHour * 60; m += CONFIG.slotMinutes) {
    const h = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    const t = `${h}:${mm}`;
    if (!CONFIG.blockedTimes.includes(t)) slots.push(t);
  }
  return slots;
}

/** 현재 KST 기준 YYYY-MM-DD */
export function todayKST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: CONFIG.timeZone }).format(new Date());
}

/** 현재 KST 기준 HH:MM */
export function nowTimeKST(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: CONFIG.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

export function isDateSelectable(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const today = todayKST();
  if (date < today) return false;
  const d = new Date(date + "T00:00:00Z");
  if (!CONFIG.openDays.includes(d.getUTCDay())) return false;
  const limit = new Date(today + "T00:00:00Z");
  limit.setUTCDate(limit.getUTCDate() + CONFIG.maxDaysAhead);
  return d <= limit;
}
