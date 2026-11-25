import { test } from "node:test";
import assert from "node:assert/strict";
import { copyDraft } from "../src/lib/schedule/draft";
import type { ScheduleInput } from "../src/lib/schedule/rules";

const base: ScheduleInput = {
  title: "중간고사 면담",
  description: "",
  mode: "offline",
  location: "709호",
  meetingUrl: "",
  slotMinutes: 30,
  bufferMinutes: 10,
  maxPerDay: 3,
  maxBookingsPerStudent: 1,
  bookingCloseHours: 0,
  cancelCloseHours: 0,
  audience: "selected",
  audienceIds: ["a", "b"],
  ruleType: "recurring",
  recurring: {
    from: "2030-03-04", // 월
    to: "2030-03-17",
    windows: [{ days: [1], start: "10:00", end: "12:00" }],
    excludeDates: ["2030-03-11"],
    overrides: [{ date: "2030-03-13", windows: [{ start: "14:00", end: "15:00" }] }],
  },
  manualSlots: [],
};

test("아직 시작 전인 일정은 날짜를 그대로 두고 설정을 모두 옮긴다", () => {
  const { draft, shiftedWeeks } = copyDraft(base, { today: "2030-03-01", sameCourse: true, memberIds: ["a", "b"] });
  assert.equal(shiftedWeeks, 0);
  assert.equal(draft.title, "중간고사 면담 (복사본)");
  assert.equal(draft.from, "2030-03-04");
  assert.equal(draft.bufferMinutes, "10");
  assert.equal(draft.maxPerDay, "3");
  assert.deepEqual(draft.audienceIds, ["a", "b"]);
});

test("지난 일정은 주 단위로 미뤄 요일을 유지하고 제외일·날짜별 변경도 함께 옮긴다", () => {
  // 3월 4일 → 9월 1일까지 181일 → 26주(182일) 뒤 = 9월 2일(월)
  const { draft, shiftedWeeks } = copyDraft(base, { today: "2030-09-01", sameCourse: true, memberIds: ["a", "b"] });
  assert.equal(shiftedWeeks, 26);
  assert.equal(draft.from, "2030-09-02");
  assert.equal(draft.to, "2030-09-15");
  assert.equal(draft.excludeDates, "2030-09-09");
  assert.equal(draft.overrides[0].date, "2030-09-11");
  assert.equal(new Date(draft.from + "T00:00:00Z").getUTCDay(), 1);
});

test("직접 지정 시간도 같은 주 수만큼 옮긴다", () => {
  const manual: ScheduleInput = { ...base, ruleType: "manual", recurring: null, manualSlots: ["2030-03-05T10:00", "2030-03-06T14:30"] };
  const { draft, shiftedWeeks } = copyDraft(manual, { today: "2030-03-10", sameCourse: true, memberIds: [] });
  assert.equal(shiftedWeeks, 1);
  assert.deepEqual(draft.manualSlots, ["2030-03-12T10:00", "2030-03-13T14:30"]);
});

test("다른 그룹으로 복제하면 대상은 전체, 같은 그룹이면 남은 학생만 유지한다", () => {
  assert.equal(copyDraft(base, { today: "2030-03-01", sameCourse: false, memberIds: ["a"] }).draft.audience, "all");
  const same = copyDraft(base, { today: "2030-03-01", sameCourse: true, memberIds: ["b"] }).draft;
  assert.deepEqual([same.audience, same.audienceIds], ["selected", ["b"]]);
  const gone = copyDraft(base, { today: "2030-03-01", sameCourse: true, memberIds: [] }).draft;
  assert.deepEqual([gone.audience, gone.audienceIds], ["all", []]);
});

test("긴 이름도 50자 제한 안에 들어간다", () => {
  const long = copyDraft({ ...base, title: "가".repeat(50) }, { today: "2030-03-01", sameCourse: true, memberIds: [] }).draft.title;
  assert.ok(long.length <= 50);
});
