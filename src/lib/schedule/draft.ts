import { addDays, daysBetween, type ScheduleInput } from "./rules";

// 일정 입력 폼의 편집 상태 ↔ 저장 형식 변환 (서버·브라우저 공용)

export type ScheduleDraft = {
  title: string;
  description: string;
  mode: "offline" | "online";
  location: string;
  meetingUrl: string;
  slotMinutes: string;
  bufferMinutes: string;
  maxPerDay: string;
  maxBookingsPerStudent: string;
  bookingCloseHours: string;
  cancelCloseHours: string;
  audience: "all" | "selected";
  audienceIds: string[];
  ruleType: "recurring" | "manual";
  from: string;
  to: string;
  windows: { days: number[]; start: string; end: string }[];
  /** 줄바꿈으로 구분한 날짜 목록 */
  excludeDates: string;
  /** 날짜별 예외 시간 */
  overrides: { date: string; windows: { start: string; end: string }[] }[];
  manualSlots: string[];
};

export function draftFromSchedule(s: ScheduleInput): ScheduleDraft {
  return {
    title: s.title,
    description: s.description,
    mode: s.mode,
    location: s.location,
    meetingUrl: s.meetingUrl,
    slotMinutes: String(s.slotMinutes),
    bufferMinutes: String(s.bufferMinutes ?? 0),
    maxPerDay: String(s.maxPerDay ?? 0),
    maxBookingsPerStudent: String(s.maxBookingsPerStudent),
    bookingCloseHours: String(s.bookingCloseHours),
    cancelCloseHours: String(s.cancelCloseHours),
    audience: s.audience,
    audienceIds: s.audienceIds,
    ruleType: s.ruleType,
    from: s.recurring?.from ?? "",
    to: s.recurring?.to ?? "",
    windows: s.recurring?.windows ?? [{ days: [1], start: "10:00", end: "12:00" }],
    excludeDates: (s.recurring?.excludeDates ?? []).join("\n"),
    overrides: s.recurring?.overrides ?? [],
    manualSlots: s.manualSlots,
  };
}

/** 새 일정 기본값: 오늘부터 4주, 월·수 10~12시, 30분 */
export function emptyDraft(today: string, location: string): ScheduleDraft {
  return {
    title: "",
    description: "",
    mode: "offline",
    location,
    meetingUrl: "",
    slotMinutes: "30",
    bufferMinutes: "0",
    maxPerDay: "0",
    maxBookingsPerStudent: "1",
    bookingCloseHours: "0",
    cancelCloseHours: "0",
    audience: "all",
    audienceIds: [],
    ruleType: "recurring",
    from: today,
    to: addDays(today, 27),
    windows: [{ days: [1, 3], start: "10:00", end: "12:00" }],
    excludeDates: "",
    overrides: [],
    manualSlots: [],
  };
}

export function draftToInput(d: ScheduleDraft) {
  return {
    title: d.title,
    description: d.description,
    mode: d.mode,
    location: d.location,
    meetingUrl: d.meetingUrl,
    slotMinutes: Number(d.slotMinutes),
    bufferMinutes: Number(d.bufferMinutes),
    maxPerDay: Number(d.maxPerDay),
    maxBookingsPerStudent: Number(d.maxBookingsPerStudent),
    bookingCloseHours: Number(d.bookingCloseHours),
    cancelCloseHours: Number(d.cancelCloseHours),
    audience: d.audience,
    audienceIds: d.audienceIds,
    ruleType: d.ruleType,
    recurring:
      d.ruleType === "recurring"
        ? { from: d.from, to: d.to, windows: d.windows, excludeDates: d.excludeDates.split(/[\n,\s]+/).filter(Boolean), overrides: d.overrides }
        : null,
    manualSlots: d.manualSlots,
  };
}

/**
 * 기존 일정을 복제해 새 일정 초안을 만든다.
 * - 기간이 지난 일정이면 날짜 전체(기간·제외일·날짜별 변경·직접 지정 시간)를 주 단위로 미뤄 요일을 유지한다.
 * - 다른 그룹으로 복제하면 대상 학생 지정은 "전체"로 되돌린다 (학생 목록이 다르므로).
 * - 같은 그룹이면 지금 그룹에 남아 있는 학생만 유지한다.
 */
export function copyDraft(
  src: ScheduleInput,
  opts: { today: string; sameCourse: boolean; memberIds: string[] },
): { draft: ScheduleDraft; shiftedWeeks: number } {
  const d = draftFromSchedule(src);
  d.title = `${src.title.slice(0, 44)} (복사본)`; // 일정 이름 50자 제한

  if (!opts.sameCourse) {
    d.audience = "all";
    d.audienceIds = [];
  } else {
    d.audienceIds = d.audienceIds.filter((id) => opts.memberIds.includes(id));
    if (d.audience === "selected" && !d.audienceIds.length) d.audience = "all";
  }

  const first = src.ruleType === "recurring" ? src.recurring?.from : [...src.manualSlots].sort()[0]?.slice(0, 10);
  const lag = first ? daysBetween(first, opts.today) : 0;
  const shiftedWeeks = lag > 0 ? Math.ceil(lag / 7) : 0;
  if (shiftedWeeks) {
    const n = shiftedWeeks * 7;
    const mv = (date: string) => addDays(date, n);
    if (d.from) d.from = mv(d.from);
    if (d.to) d.to = mv(d.to);
    d.excludeDates = d.excludeDates.split(/[\n,\s]+/).filter(Boolean).map(mv).join("\n");
    d.overrides = d.overrides.map((o) => ({ ...o, date: mv(o.date) }));
    d.manualSlots = d.manualSlots.map((s) => mv(s.slice(0, 10)) + s.slice(10));
  }
  return { draft: d, shiftedWeeks };
}
