// 상담 운영 설정 — 교수님별 가능 요일/시간/슬롯 단위를 여기서 관리합니다.

/** 요일별 상담 가능 시간대. days: 0=일 ... 6=토, start 이상 end 미만 시각에 상담을 시작할 수 있음 (end는 상담 종료 상한) */
export type Availability = { days: number[]; start: string; end: string };

export type Professor = {
  id: string;
  name: string;
  /** 슬롯(상담 1회) 길이, 분 */
  slotMinutes: number;
  availability: Availability[];
  /** 이 날짜들은 예약 불가 */
  excludeDates?: string[];
  /** 지정 시 이 날짜들만 예약 가능 (요일 규칙과 함께 적용) */
  onlyDates?: string[];
  /** 안내 문구 */
  note?: string;
  phone?: string;
  office?: string;
};

export const PROFESSORS: Professor[] = [
  {
    id: "jeon",
    name: "전유부 교수님",
    slotMinutes: 60,
    availability: [{ days: [1, 4, 5], start: "10:00", end: "17:00" }],
    excludeDates: ["2026-09-21", "2026-10-15"],
    note: "월·목·금 10:00~17:00, 1시간 단위",
    phone: "010-3301-2176",
    office: "연구관 709호",
  },
  {
    id: "jung",
    name: "정병덕 교수님",
    slotMinutes: 30,
    availability: [{ days: [2], start: "09:00", end: "16:00" }],
    onlyDates: ["2026-09-22", "2026-09-29", "2026-10-06", "2026-10-13"],
    note: "화 09:00~16:00, 30분 단위 (9/22, 9/29, 10/6, 10/13)",
    phone: "010-3456-8620",
    office: "연구관 713호",
  },
  {
    id: "choi",
    name: "최정섭 교수님",
    slotMinutes: 30,
    availability: [
      { days: [1, 3, 5], start: "09:00", end: "20:00" },
      { days: [4], start: "09:00", end: "17:00" }, // 목요일은 17시 이후 불가
    ],
    note: "월·수·목·금 09:00~20:00 (목요일은 17:00까지), 30분 단위",
    phone: "010-6396-1151",
    office: "연구관 618호",
  },
];

export const CONFIG = {
  /** 오늘부터 며칠 후까지 예약 가능한지 */
  maxDaysAhead: 60,
  /** 표시용 타임존 */
  timeZone: "Asia/Seoul",
};

export function getProfessor(id: unknown): Professor | null {
  return PROFESSORS.find((p) => p.id === id) ?? null;
}

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

function weekday(date: string) {
  return new Date(date + "T00:00:00Z").getUTCDay();
}

function availabilityFor(prof: Professor, date: string): Availability | null {
  const d = weekday(date);
  return prof.availability.find((a) => a.days.includes(d)) ?? null;
}

/** 해당 교수님의 해당 날짜 상담 시작 시각 목록 */
export function generateTimeSlots(prof: Professor, date: string): string[] {
  const a = availabilityFor(prof, date);
  if (!a) return [];
  const slots: string[] = [];
  for (let m = toMin(a.start); m + prof.slotMinutes <= toMin(a.end); m += prof.slotMinutes) {
    slots.push(toTime(m));
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

export function isDateSelectable(prof: Professor, date: string, today = todayKST()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  if (date < today) return false;
  const limit = new Date(today + "T00:00:00Z");
  limit.setUTCDate(limit.getUTCDate() + CONFIG.maxDaysAhead);
  if (new Date(date + "T00:00:00Z") > limit) return false;
  if (prof.excludeDates?.includes(date)) return false;
  if (prof.onlyDates && !prof.onlyDates.includes(date)) return false;
  return availabilityFor(prof, date) !== null;
}
