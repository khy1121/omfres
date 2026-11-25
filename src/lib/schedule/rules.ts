import { z } from "zod";

// 상담 일정의 시간 규칙과 슬롯 계산 (순수 함수, 서버·브라우저 공용)
// - 날짜는 "YYYY-MM-DD", 시각은 "HH:MM" (모두 한국 시간 기준)
// - 시작 시각과 상담 길이는 5분 단위 (동시 예약 방지 잠금 단위와 일치)

export const BLOCK_MINUTES = 5;
export const MAX_RANGE_DAYS = 366;
export const MAX_TOTAL_SLOTS = 3000;
export const WEEKDAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

export type TimeWindow = { days: number[]; start: string; end: string };
/** 날짜별 예외 시간: 그날은 요일별 시간대 대신 이 시간대로 상담한다 (요일에 없는 날 추가도 가능) */
export type DateOverride = { date: string; windows: { start: string; end: string }[] };
export type RecurringRule = {
  from: string;
  to: string;
  windows: TimeWindow[];
  excludeDates: string[];
  /** 예전에 저장된 일정에는 없다 */
  overrides?: DateOverride[];
};
export type RuleType = "recurring" | "manual";
export type SlotConfig = {
  slotMinutes: number;
  /** 상담이 끝난 뒤 교수자가 쉬는 시간(분). 다른 상담을 이 시간 안에 시작할 수 없다 */
  bufferMinutes?: number;
  /** 이 일정의 하루 최대 상담 수 (0 또는 없음 = 제한 없음) */
  maxPerDay?: number;
  ruleType: RuleType;
  recurring: RecurringRule | null;
  /** 직접 지정 슬롯: "YYYY-MM-DD HH:MM" */
  manualSlots: string[];
};

// ── 날짜·시각 기본 연산 ──

export function isValidDate(date: unknown): date is string {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(date + "T00:00:00Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

export function isValidTime(time: unknown): time is string {
  return typeof time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

export const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export const addMinutes = (time: string, min: number) => toTime(toMin(time) + min);

export function weekday(date: string): number {
  return new Date(date + "T00:00:00Z").getUTCDay();
}

export function addDays(date: string, n: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / 86_400_000);
}

/** 한국 시간 날짜·시각 → epoch ms */
export function kstInstant(date: string, time: string): number {
  return Date.parse(`${date}T${time}:00+09:00`);
}

/** epoch ms → 한국 시간 { date, time } */
export function kstParts(ms: number): { date: string; time: string } {
  const iso = new Date(ms + 9 * 3600_000).toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

export function fmtDays(days: number[]): string {
  return [...days].sort((a, b) => a - b).map((d) => WEEKDAY_NAMES[d]).join("·");
}

/** "2026년 11월 25일 (수)" */
export function fmtDateKo(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일 (${WEEKDAY_NAMES[weekday(date)]})`;
}

/** "11월 25일 (수)" */
export function fmtDateShort(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${m}월 ${d}일 (${WEEKDAY_NAMES[weekday(date)]})`;
}

// ── 슬롯 계산 ──

/** 해당 날짜의 상담 시작 시각 목록 (정렬, 중복 없음) */
export function slotTimesForDate(cfg: SlotConfig, date: string): string[] {
  if (cfg.ruleType === "manual") {
    return cfg.manualSlots.filter((s) => s.slice(0, 10) === date).map((s) => s.slice(11)).sort();
  }
  const r = cfg.recurring;
  if (!r || date < r.from || date > r.to || r.excludeDates.includes(date)) return [];
  const windows = windowsForDate(r, date);
  const times = new Set<string>();
  for (const w of windows) {
    // 여유 시간이 있으면 상담 길이 + 여유 시간 간격으로 시작 시각을 만든다 (같은 일정의 연속 상담끼리 막히지 않도록)
    for (let m = toMin(w.start); m + cfg.slotMinutes <= toMin(w.end); m += cfg.slotMinutes + (cfg.bufferMinutes ?? 0)) times.add(toTime(m));
  }
  return [...times].sort();
}

/** 그날 적용되는 시간대: 날짜별 예외가 있으면 그것, 없으면 요일별 시간대 */
export function windowsForDate(r: RecurringRule, date: string): { start: string; end: string }[] {
  const override = r.overrides?.find((o) => o.date === date);
  if (override) return override.windows;
  const dow = weekday(date);
  return r.windows.filter((w) => w.days.includes(dow)).map(({ start, end }) => ({ start, end }));
}

/** 상담이 하나라도 있는 날짜 목록 */
export function scheduleDates(cfg: SlotConfig): string[] {
  if (cfg.ruleType === "manual") return [...new Set(cfg.manualSlots.map((s) => s.slice(0, 10)))].sort();
  const r = cfg.recurring;
  if (!r) return [];
  const out: string[] = [];
  for (let d = r.from; d <= r.to; d = addDays(d, 1)) if (slotTimesForDate(cfg, d).length) out.push(d);
  return out;
}

export function countSlots(cfg: SlotConfig): number {
  return scheduleDates(cfg).reduce((n, d) => n + slotTimesForDate(cfg, d).length, 0);
}

export function hasSlot(cfg: SlotConfig, date: string, time: string): boolean {
  return slotTimesForDate(cfg, date).includes(time);
}

/** 학생 달력에서 날짜를 고를 수 없는 이유. 고를 수 있으면 null */
export function dateUnavailableReason(cfg: SlotConfig, date: string, today: string): string | null {
  if (!isValidDate(date)) return "유효하지 않은 날짜";
  if (date < today) return "지난 날짜";
  if (cfg.ruleType === "recurring" && cfg.recurring) {
    if (date < cfg.recurring.from || date > cfg.recurring.to) return "상담 기간 밖";
    if (cfg.recurring.excludeDates.includes(date)) return "상담 제외일";
  }
  if (!slotTimesForDate(cfg, date).length) return "상담 없는 날";
  return null;
}

/** 달력 탐색 범위: 오늘(또는 첫 상담일) ~ 마지막 상담일 */
export function scheduleRange(cfg: SlotConfig, today: string): { first: string; last: string } | null {
  const dates = scheduleDates(cfg).filter((d) => d >= today);
  return dates.length ? { first: dates[0], last: dates[dates.length - 1] } : null;
}

/** 시간 겹침 판정 [aStart, aEnd) ∩ [bStart, bEnd) */
export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** 잠금 블록 번호 목록 (5분 단위, epoch 기준) */
export function lockBlocks(startMs: number, minutes: number): number[] {
  const first = Math.floor(startMs / (BLOCK_MINUTES * 60_000));
  return Array.from({ length: Math.ceil(minutes / BLOCK_MINUTES) }, (_, i) => first + i);
}

// ── 입력 검증 ──

const hhmm = z.string().refine(isValidTime, "시각 형식이 올바르지 않습니다.");
const ymd = z.string().refine(isValidDate, "날짜 형식이 올바르지 않습니다.");
const aligned = (t: string) => toMin(t) % BLOCK_MINUTES === 0;

const windowSchema = z
  .object({
    days: z.array(z.number().int().min(0).max(6)).min(1, "요일을 하나 이상 선택해주세요."),
    start: hhmm.refine(aligned, "시각은 5분 단위로 입력해주세요."),
    end: hhmm.refine(aligned, "시각은 5분 단위로 입력해주세요."),
  })
  .refine((w) => toMin(w.start) < toMin(w.end), "종료 시각은 시작 시각보다 늦어야 합니다.")
  .transform((w) => ({ ...w, days: [...new Set(w.days)].sort((a, b) => a - b) }));

const timeRange = z
  .object({
    start: hhmm.refine(aligned, "시각은 5분 단위로 입력해주세요."),
    end: hhmm.refine(aligned, "시각은 5분 단위로 입력해주세요."),
  })
  .refine((w) => toMin(w.start) < toMin(w.end), "종료 시각은 시작 시각보다 늦어야 합니다.");

const overrideSchema = z
  .object({
    date: ymd,
    windows: z.array(timeRange).min(1, "날짜별 시간 변경에 시간대를 하나 이상 넣어주세요.").max(4, "날짜별 시간 변경은 하루 4개 시간대까지 넣을 수 있습니다."),
  })
  .refine((o) => {
    const ws = [...o.windows].sort((a, b) => toMin(a.start) - toMin(b.start));
    return ws.every((w, i) => i === 0 || toMin(ws[i - 1].end) <= toMin(w.start));
  }, "날짜별 시간 변경의 시간대가 서로 겹칩니다.")
  .transform((o) => ({ ...o, windows: [...o.windows].sort((a, b) => toMin(a.start) - toMin(b.start)) }));

const recurringSchema = z
  .object({
    from: ymd,
    to: ymd,
    windows: z.array(windowSchema).min(1, "상담 시간대를 하나 이상 추가해주세요.").max(14, "시간대는 14개까지 추가할 수 있습니다."),
    excludeDates: z.array(ymd).max(200, "제외일은 200개까지 추가할 수 있습니다.").default([]),
    overrides: z.array(overrideSchema).max(100, "날짜별 시간 변경은 100개까지 추가할 수 있습니다.").default([]),
  })
  .refine((r) => new Set(r.overrides.map((o) => o.date)).size === r.overrides.length, "같은 날짜의 시간 변경이 두 번 들어 있습니다.")
  .refine((r) => r.overrides.every((o) => o.date >= r.from && o.date <= r.to), "날짜별 시간 변경은 상담 기간 안의 날짜만 넣을 수 있습니다.")
  .refine((r) => !r.overrides.some((o) => r.excludeDates.includes(o.date)), "제외일과 날짜별 시간 변경에 같은 날짜가 있습니다.")
  .refine((r) => r.from <= r.to, "종료일은 시작일과 같거나 이후여야 합니다.")
  .refine((r) => daysBetween(r.from, r.to) < MAX_RANGE_DAYS, `상담 기간은 ${MAX_RANGE_DAYS}일 이내로 설정해주세요.`)
  .refine((r) => {
    // 같은 요일에 겹치는 시간대가 있으면 같은 시간에 학생 둘이 예약될 수 있어 막는다
    for (let i = 0; i < r.windows.length; i++)
      for (let j = i + 1; j < r.windows.length; j++) {
        const a = r.windows[i], b = r.windows[j];
        if (a.days.some((d) => b.days.includes(d)) && overlaps(toMin(a.start), toMin(a.end), toMin(b.start), toMin(b.end))) return false;
      }
    return true;
  }, "같은 요일의 시간대가 서로 겹칩니다.")
  .transform((r) => ({
    ...r,
    excludeDates: [...new Set(r.excludeDates)].sort(),
    overrides: [...r.overrides].sort((a, b) => a.date.localeCompare(b.date)),
  }));

const manualSlot = z
  .string()
  .refine((s) => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s) && isValidDate(s.slice(0, 10)) && isValidTime(s.slice(11)), "직접 지정한 시간 형식이 올바르지 않습니다.")
  .refine((s) => aligned(s.slice(11)), "시각은 5분 단위로 입력해주세요.");

export const scheduleSchema = z
  .object({
    title: z.string({ error: "일정 이름을 입력해주세요." }).trim().min(1, "일정 이름을 입력해주세요.").max(50, "일정 이름은 50자 이하로 입력해주세요."),
    description: z.string().trim().max(500, "안내는 500자 이하로 입력해주세요.").default(""),
    mode: z.enum(["offline", "online"], { error: "상담 방식을 선택해주세요." }),
    location: z.string().trim().max(100, "장소는 100자 이하로 입력해주세요.").default(""),
    meetingUrl: z.string().trim().max(500).default(""),
    slotMinutes: z
      .number({ error: "상담 길이를 입력해주세요." })
      .int()
      .min(5, "상담 길이는 5분 이상이어야 합니다.")
      .max(240, "상담 길이는 240분 이하여야 합니다.")
      .refine((n) => n % BLOCK_MINUTES === 0, "상담 길이는 5분 단위로 입력해주세요."),
    bufferMinutes: z
      .number()
      .int()
      .min(0)
      .max(120, "여유 시간은 120분 이하로 설정해주세요.")
      .refine((n) => n % BLOCK_MINUTES === 0, "여유 시간은 5분 단위로 입력해주세요.")
      .default(0),
    maxPerDay: z.number().int().min(0).max(100, "하루 최대 상담 수는 100회 이하로 설정해주세요.").default(0),
    maxBookingsPerStudent: z.number().int().min(1, "1인당 예약 횟수는 1회 이상이어야 합니다.").max(10, "1인당 예약 횟수는 10회 이하여야 합니다."),
    bookingCloseHours: z.number().int().min(0).max(168, "예약 마감은 168시간(7일) 이내로 설정해주세요."),
    cancelCloseHours: z.number().int().min(0).max(168, "취소 마감은 168시간(7일) 이내로 설정해주세요."),
    audience: z.enum(["all", "selected"]),
    audienceIds: z.array(z.string().min(1).max(128)).max(1000).default([]),
    ruleType: z.enum(["recurring", "manual"]),
    recurring: recurringSchema.nullable().default(null),
    manualSlots: z.array(manualSlot).max(500, "직접 지정 시간은 500개까지 추가할 수 있습니다.").default([]),
  })
  .superRefine((s, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    if (s.mode === "offline" && !s.location) fail("상담 장소를 입력해주세요.");
    if (s.mode === "online" && s.meetingUrl && !/^https?:\/\/\S+$/.test(s.meetingUrl)) fail("온라인 상담 주소는 http:// 또는 https://로 시작해야 합니다.");
    if (s.audience === "selected" && !s.audienceIds.length) fail("일정을 볼 학생을 한 명 이상 선택해주세요.");
    if (s.ruleType === "recurring" && !s.recurring) fail("반복 규칙을 입력해주세요.");
    if (s.ruleType === "manual") {
      if (!s.manualSlots.length) fail("상담 시간을 하나 이상 추가해주세요.");
      if (s.manualSlots.some((x) => toMin(x.slice(11)) + s.slotMinutes > 24 * 60)) fail("상담이 자정을 넘기지 않도록 시작 시각을 정해주세요.");
      const starts = [...new Set(s.manualSlots)].sort().map((x) => kstInstant(x.slice(0, 10), x.slice(11)));
      for (let i = 1; i < starts.length; i++)
        if (starts[i] - starts[i - 1] < (s.slotMinutes + s.bufferMinutes) * 60_000) {
          fail(s.bufferMinutes ? "직접 지정한 시간끼리 상담 길이와 여유 시간만큼 떨어져 있어야 합니다." : "직접 지정한 시간끼리 상담 길이만큼 겹칩니다.");
          break;
        }
    }
  })
  .transform((s) => ({
    ...s,
    location: s.mode === "offline" ? s.location : s.location,
    meetingUrl: s.mode === "online" ? s.meetingUrl : "",
    audienceIds: s.audience === "selected" ? [...new Set(s.audienceIds)] : [],
    recurring: s.ruleType === "recurring" ? s.recurring : null,
    manualSlots: s.ruleType === "manual" ? [...new Set(s.manualSlots)].sort() : [],
  }))
  .superRefine((s, ctx) => {
    const n = countSlots(s);
    if (n === 0) ctx.addIssue({ code: "custom", message: "설정한 기간·시간대에 만들어지는 상담 시간이 없습니다." });
    if (n > MAX_TOTAL_SLOTS) ctx.addIssue({ code: "custom", message: `상담 시간이 ${n}개로 너무 많습니다. ${MAX_TOTAL_SLOTS}개 이하로 줄여주세요.` });
  });

export type ScheduleInput = z.output<typeof scheduleSchema>;

export function parseScheduleInput(input: unknown): { data: ScheduleInput } | { error: string } {
  const r = scheduleSchema.safeParse(input ?? {});
  return r.success ? { data: r.data } : { error: r.error.issues[0].message };
}

// ── 예약 가능 판정 ──

/**
 * 마감 판정: 상담 시작 N시간 전"까지" 허용 (정확히 N시간 전은 허용).
 * N=0이면 시작 전까지만 허용 (시작 시각부터 마감).
 */
export function isPastDeadline(startMs: number, hours: number, now: number): boolean {
  return now >= startMs || now > startMs - hours * 3600_000;
}

/** holdEnd: 상담 후 여유 시간까지 포함한 교수자 점유 끝 (없으면 end) */
export type BusyInterval = { start: number; end: number; holdEnd?: number; scheduleId: string; studentId: string };

export type SlotState = {
  time: string;
  end: string;
  available: boolean;
  /** mine: 이 일정의 내 예약, taken: 다른 사람이 예약(또는 교수 다른 일정과 겹침), overlap: 내 다른 예약과 겹침, closed: 마감 시간 지남 */
  reason: "mine" | "taken" | "overlap" | "closed" | "full" | null;
  bookingId?: string;
};

/**
 * 학생에게 보여줄 날짜별 슬롯 상태.
 * @param instructorBusy 교수자의 그날 예약 전체 (모든 일정)
 * @param myBusy 학생 본인의 그날 예약 전체 (모든 일정)
 * @param ignoreBookingId 일정 변경 중인 예약 (자기 자신과의 겹침은 무시)
 */
export function daySlotStates(args: {
  cfg: SlotConfig;
  scheduleId: string;
  date: string;
  studentId: string;
  instructorBusy: (BusyInterval & { bookingId: string })[];
  myBusy: (BusyInterval & { bookingId: string })[];
  bookingCloseHours: number;
  now: number;
  ignoreBookingId?: string | null;
}): SlotState[] {
  const { cfg, scheduleId, date, studentId, instructorBusy, myBusy, bookingCloseHours, now, ignoreBookingId } = args;
  // 하루 최대에 도달했으면 내 예약 외에는 모두 마감 (이동 중인 예약 자신은 세지 않음)
  const dayCount = instructorBusy.filter((b) => b.scheduleId === scheduleId && b.bookingId !== ignoreBookingId).length;
  const dayFull = !!cfg.maxPerDay && dayCount >= cfg.maxPerDay;
  return slotTimesForDate(cfg, date).map((time) => {
    const start = kstInstant(date, time);
    const end = start + cfg.slotMinutes * 60_000;
    const holdEnd = end + (cfg.bufferMinutes ?? 0) * 60_000;
    const base = { time, end: addMinutes(time, cfg.slotMinutes) };
    const mine = myBusy.find((b) => b.scheduleId === scheduleId && b.start === start && b.bookingId !== ignoreBookingId);
    if (mine) return { ...base, available: false, reason: "mine", bookingId: mine.bookingId };
    if (isPastDeadline(start, bookingCloseHours, now)) return { ...base, available: false, reason: "closed" };
    if (dayFull) return { ...base, available: false, reason: "full" };
    if (instructorBusy.some((b) => b.bookingId !== ignoreBookingId && b.studentId !== studentId && overlaps(start, holdEnd, b.start, b.holdEnd ?? b.end))) {
      return { ...base, available: false, reason: "taken" };
    }
    if (myBusy.some((b) => b.bookingId !== ignoreBookingId && overlaps(start, end, b.start, b.end))) {
      return { ...base, available: false, reason: "overlap" };
    }
    return { ...base, available: true, reason: null };
  });
}

export type AvailabilitySummary = {
  /** 날짜별 지금 예약할 수 있는 시간 수 (오늘 이후 상담이 있는 날만) */
  days: Record<string, number>;
  /** 가장 빠른 예약 가능 시간 */
  next: { date: string; time: string } | null;
};

/**
 * 일정 전체 기간의 날짜별 예약 가능 시간 수와 가장 빠른 시간.
 * 날짜별 판정은 daySlotStates와 같은 규칙을 써서 시간 목록과 어긋나지 않는다.
 * @param instructorBusyByDate / myBusyByDate 날짜("YYYY-MM-DD")별 예약 목록
 */
export function availabilitySummary(args: {
  cfg: SlotConfig;
  scheduleId: string;
  studentId: string;
  today: string;
  instructorBusyByDate: Map<string, (BusyInterval & { bookingId: string })[]>;
  myBusyByDate: Map<string, (BusyInterval & { bookingId: string })[]>;
  bookingCloseHours: number;
  now: number;
  ignoreBookingId?: string | null;
}): AvailabilitySummary {
  const days: Record<string, number> = {};
  let next: AvailabilitySummary["next"] = null;
  for (const date of scheduleDates(args.cfg)) {
    if (date < args.today) continue;
    const states = daySlotStates({
      cfg: args.cfg,
      scheduleId: args.scheduleId,
      date,
      studentId: args.studentId,
      instructorBusy: args.instructorBusyByDate.get(date) ?? [],
      myBusy: args.myBusyByDate.get(date) ?? [],
      bookingCloseHours: args.bookingCloseHours,
      now: args.now,
      ignoreBookingId: args.ignoreBookingId,
    });
    const open = states.filter((s) => s.available);
    days[date] = open.length;
    if (!next && open.length) next = { date, time: open[0].time };
  }
  return { days, next };
}

/** 기간·제외일 문자열 등 화면 표시용 요약 */
export function describeRule(cfg: SlotConfig): string {
  if (cfg.ruleType === "manual") {
    const dates = scheduleDates(cfg);
    return dates.length ? `직접 지정 ${cfg.manualSlots.length}개 · ${fmtDateShort(dates[0])}${dates.length > 1 ? ` ~ ${fmtDateShort(dates[dates.length - 1])}` : ""}` : "직접 지정";
  }
  const r = cfg.recurring!;
  const windows = r.windows.map((w) => `${fmtDays(w.days)} ${w.start}~${w.end}`).join(", ");
  const changed = r.overrides?.length ? ` · 날짜별 시간 변경 ${r.overrides.length}일` : "";
  return `${fmtDateShort(r.from)} ~ ${fmtDateShort(r.to)} · ${windows}${changed}`;
}
