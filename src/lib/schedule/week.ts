import { addDays, slotTimesForDate, weekday, type SlotConfig } from "./rules";

// 예약 현황 주간 보기 (순수 함수): 월요일부터 7일, 날마다 이 일정의 예약과 다른 수업 상담을 시간순으로

export type WeekItem = {
  key: string;
  time: string;
  endTime: string;
  /** this: 이 일정의 예약, other: 같은 교수의 다른 일정 예약 */
  kind: "this" | "other";
  title: string;
  sub: string;
};

export type WeekDay = {
  date: string;
  /** 이 일정에서 그날 열리는 상담 수 (규칙 기준) */
  slotCount: number;
  items: WeekItem[];
};

type WeekBooking = {
  id: string;
  scheduleId: string;
  date: string;
  time: string;
  endTime: string;
  studentName: string;
  studentNo: string | null;
  courseTitle: string;
  scheduleTitle: string;
};

/** 그 날짜가 속한 주의 월요일 */
export function weekStart(date: string): string {
  return addDays(date, -((weekday(date) + 6) % 7));
}

export function buildWeek(args: { start: string; cfg: SlotConfig; scheduleId: string; bookings: WeekBooking[] }): WeekDay[] {
  const { start, cfg, scheduleId, bookings } = args;
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    const items = bookings
      .filter((b) => b.date === date)
      .map((b): WeekItem =>
        b.scheduleId === scheduleId
          ? { key: b.id, time: b.time, endTime: b.endTime, kind: "this", title: b.studentName, sub: b.studentNo ?? "" }
          : { key: b.id, time: b.time, endTime: b.endTime, kind: "other", title: b.courseTitle, sub: b.scheduleTitle },
      )
      .sort((a, b) => a.time.localeCompare(b.time));
    return { date, slotCount: slotTimesForDate(cfg, date).length, items };
  });
}
