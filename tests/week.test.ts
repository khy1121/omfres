import { test } from "node:test";
import assert from "node:assert/strict";
import { buildWeek, weekStart } from "../src/lib/schedule/week";
import type { SlotConfig } from "../src/lib/schedule/rules";

const cfg: SlotConfig = {
  slotMinutes: 30,
  ruleType: "recurring",
  recurring: { from: "2030-03-01", to: "2030-03-31", windows: [{ days: [1, 3], start: "10:00", end: "11:00" }], excludeDates: [] },
  manualSlots: [],
};

test("주의 시작은 월요일 (일요일은 앞 주에 속한다)", () => {
  assert.equal(weekStart("2030-03-04"), "2030-03-04"); // 월
  assert.equal(weekStart("2030-03-06"), "2030-03-04"); // 수
  assert.equal(weekStart("2030-03-10"), "2030-03-04"); // 일
});

test("날마다 상담 칸 수와 예약을 시간순으로, 다른 수업 상담은 수업 이름으로 보여준다", () => {
  const b = (id: string, scheduleId: string, date: string, time: string, endTime: string) => ({
    id, scheduleId, date, time, endTime, studentName: "홍길동", studentNo: "2071234", courseTitle: "운영체제", scheduleTitle: "기말 면담",
  });
  const days = buildWeek({
    start: "2030-03-04",
    cfg,
    scheduleId: "s",
    bookings: [b("1", "s", "2030-03-04", "10:30", "11:00"), b("2", "o", "2030-03-04", "09:00", "09:20"), b("3", "s", "2030-03-11", "10:00", "10:30")],
  });
  assert.equal(days.length, 7);
  assert.deepEqual(days.map((d) => d.slotCount), [2, 0, 2, 0, 0, 0, 0]);
  assert.deepEqual(
    days[0].items.map((i) => [i.time, i.kind, i.title, i.sub]),
    [
      ["09:00", "other", "운영체제", "기말 면담"],
      ["10:30", "this", "홍길동", "2071234"],
    ],
  );
  assert.equal(days.flatMap((d) => d.items).length, 2); // 다음 주 예약은 빠진다
});
