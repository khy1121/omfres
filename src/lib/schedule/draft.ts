import { addDays, type ScheduleInput } from "./rules";

// 일정 입력 폼의 편집 상태 ↔ 저장 형식 변환 (서버·브라우저 공용)

export type ScheduleDraft = {
  title: string;
  description: string;
  mode: "offline" | "online";
  location: string;
  meetingUrl: string;
  slotMinutes: string;
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
    maxBookingsPerStudent: Number(d.maxBookingsPerStudent),
    bookingCloseHours: Number(d.bookingCloseHours),
    cancelCloseHours: Number(d.cancelCloseHours),
    audience: d.audience,
    audienceIds: d.audienceIds,
    ruleType: d.ruleType,
    recurring:
      d.ruleType === "recurring"
        ? { from: d.from, to: d.to, windows: d.windows, excludeDates: d.excludeDates.split(/[\n,\s]+/).filter(Boolean) }
        : null,
    manualSlots: d.manualSlots,
  };
}
