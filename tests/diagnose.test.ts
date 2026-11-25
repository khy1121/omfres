import { test } from "node:test";
import assert from "node:assert/strict";
import { diagnoseDate, type DiagnoseBooking } from "../src/lib/schedule/diagnose";
import { kstInstant, type SlotConfig } from "../src/lib/schedule/rules";

// 2030-03-04는 월요일
const cfg: SlotConfig = {
  slotMinutes: 30,
  bufferMinutes: 10,
  maxPerDay: 2,
  ruleType: "recurring",
  recurring: {
    from: "2030-03-01",
    to: "2030-03-31",
    windows: [{ days: [1], start: "10:00", end: "12:00" }],
    excludeDates: ["2030-03-11"],
    overrides: [{ date: "2030-03-12", windows: [{ start: "14:00", end: "15:00" }] }],
  },
  manualSlots: [],
};
const now = kstInstant("2030-03-01", "09:00");
const bk = (date: string, time: string, scheduleId: string, label: string, min = 30, buf = 10): DiagnoseBooking => {
  const start = kstInstant(date, time);
  const end = start + min * 60_000;
  return { start, end, holdEnd: end + buf * 60_000, scheduleId, label };
};

test("요일에 없는 날·제외일·기간 밖은 날짜 단위 이유를 준다", () => {
  const sun = diagnoseDate({ cfg, scheduleId: "s", date: "2030-03-03", now, bookings: [] });
  assert.equal(sun.dayReason, "상담 없는 날");
  assert.equal(sun.source, "weekly");
  assert.deepEqual(sun.slots, []);
  assert.equal(diagnoseDate({ cfg, scheduleId: "s", date: "2030-03-11", now, bookings: [] }).dayReason, "상담 제외일");
  assert.equal(diagnoseDate({ cfg, scheduleId: "s", date: "2030-04-01", now, bookings: [] }).dayReason, "상담 기간 밖");
});

test("날짜별 시간 변경이 적용된 날은 출처와 시간대를 알려준다", () => {
  const d = diagnoseDate({ cfg, scheduleId: "s", date: "2030-03-12", now, bookings: [] });
  assert.equal(d.source, "override");
  assert.deepEqual(d.windows, [{ start: "14:00", end: "15:00" }]);
  assert.deepEqual(d.slots.map((s) => s.time), ["14:00"]);
});

test("시간마다 예약됨 / 다른 상담 겹침 / 여유 시간 / 하루 최대 이유를 구분한다", () => {
  const date = "2030-03-04"; // 10:00, 10:40, 11:20
  const one = diagnoseDate({
    cfg,
    scheduleId: "s",
    date,
    now,
    bookings: [bk(date, "10:00", "s", "홍길동"), bk(date, "11:10", "other", "운영체제 · 면담", 20, 0)],
  });
  assert.deepEqual(
    one.slots.map((s) => [s.time, s.status, s.detail]),
    [
      ["10:00", "booked", "홍길동"],
      ["10:40", "buffer", "운영체제 · 면담"], // 10:40~11:10 + 여유 10분이 11:10 상담에 걸림
      ["11:20", "conflict", "운영체제 · 면담"],
    ],
  );

  const full = diagnoseDate({ cfg, scheduleId: "s", date, now, bookings: [bk(date, "10:00", "s", "A"), bk(date, "10:40", "s", "B")] });
  assert.deepEqual(full.slots.map((s) => s.status), ["booked", "booked", "dayFull"]);
});

test("지난 날짜도 진단하고, 지난 시간은 past로 표시한다", () => {
  const later = kstInstant("2030-03-04", "10:30");
  const d = diagnoseDate({ cfg, scheduleId: "s", date: "2030-03-04", now: later, bookings: [] });
  assert.equal(d.dayReason, null);
  assert.deepEqual(d.slots.map((s) => s.status), ["past", "open", "open"]);
});
