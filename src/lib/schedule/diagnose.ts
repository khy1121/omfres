import { addMinutes, dateUnavailableReason, kstInstant, overlaps, slotTimesForDate, windowsForDate, type SlotConfig } from "./rules";

// 교수용 "이 날짜에 상담이 없는 이유" 진단 (순수 함수)
// 학생 화면은 이유를 뭉뚱그려 "마감"으로 보여주지만, 교수에게는 시간마다 왜 막혔는지 알려준다.

export type DiagnoseBooking = {
  start: number;
  end: number;
  /** 상담 후 여유 시간까지 포함한 교수자 점유 끝 */
  holdEnd: number;
  scheduleId: string;
  /** 화면에 보여줄 설명 (예: "홍길동 2071234" / "운영체제 · 프로젝트 면담") */
  label: string;
};

export type SlotDiagnosis = {
  time: string;
  end: string;
  status: "open" | "booked" | "conflict" | "buffer" | "dayFull" | "past";
  detail: string | null;
};

export type DateDiagnosis = {
  date: string;
  /** 그날 상담 자체가 없는 이유 (있으면 slots는 비어 있음) */
  dayReason: string | null;
  /** 그날 적용된 시간대와 출처 */
  source: "weekly" | "override" | "manual" | null;
  windows: { start: string; end: string }[];
  slots: SlotDiagnosis[];
};

export function diagnoseDate(args: {
  cfg: SlotConfig;
  scheduleId: string;
  date: string;
  now: number;
  /** 그날 교수자의 모든 예약 (모든 수업) */
  bookings: DiagnoseBooking[];
}): DateDiagnosis {
  const { cfg, scheduleId, date, now, bookings } = args;
  // 지난 날짜도 진단은 보여준다 (예약 기록 확인용) — 그래서 오늘 대신 그 날짜를 기준으로 넘긴다
  const reason = dateUnavailableReason(cfg, date, date);
  let source: DateDiagnosis["source"] = null;
  let windows: { start: string; end: string }[] = [];
  if (cfg.ruleType === "manual") {
    source = "manual";
  } else if (cfg.recurring) {
    source = cfg.recurring.overrides?.some((o) => o.date === date) ? "override" : "weekly";
    windows = windowsForDate(cfg.recurring, date);
  }
  if (reason) return { date, dayReason: reason, source: reason === "상담 없는 날" ? source : null, windows, slots: [] };

  const buffer = (cfg.bufferMinutes ?? 0) * 60_000;
  const ownCount = bookings.filter((b) => b.scheduleId === scheduleId).length;
  const dayFull = !!cfg.maxPerDay && ownCount >= cfg.maxPerDay;

  const slots = slotTimesForDate(cfg, date).map((time): SlotDiagnosis => {
    const start = kstInstant(date, time);
    const end = start + cfg.slotMinutes * 60_000;
    const base = { time, end: addMinutes(time, cfg.slotMinutes) };
    const own = bookings.find((b) => b.scheduleId === scheduleId && b.start === start);
    if (own) return { ...base, status: "booked", detail: own.label };
    const clash = bookings.find((b) => overlaps(start, end, b.start, b.end));
    if (clash) return { ...base, status: "conflict", detail: clash.label };
    const rest = bookings.find((b) => overlaps(start, end + buffer, b.start, b.holdEnd));
    if (rest) return { ...base, status: "buffer", detail: rest.label };
    if (dayFull) return { ...base, status: "dayFull", detail: `하루 최대 ${cfg.maxPerDay}회 도달` };
    if (start <= now) return { ...base, status: "past", detail: null };
    return { ...base, status: "open", detail: null };
  });
  return { date, dayReason: null, source, windows, slots };
}
