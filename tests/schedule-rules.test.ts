import { test } from "node:test";
import assert from "node:assert/strict";
import {
  countSlots,
  dateUnavailableReason,
  daySlotStates,
  kstInstant,
  kstParts,
  lockBlocks,
  parseScheduleInput,
  scheduleDates,
  slotTimesForDate,
  type SlotConfig,
} from "../src/lib/schedule/rules";

const recurring: SlotConfig = {
  slotMinutes: 30,
  ruleType: "recurring",
  recurring: {
    from: "2026-12-01",
    to: "2026-12-31",
    windows: [
      { days: [1, 3], start: "10:00", end: "12:00" }, // 월·수
      { days: [4], start: "14:00", end: "15:15" }, // 목: 14:00, 14:30 (14:45~15:15 들어가지만 30분 간격이라 14:00, 14:30만)
    ],
    excludeDates: ["2026-12-02"],
  },
  manualSlots: [],
};

const base = {
  title: "중간 면담",
  description: "",
  mode: "offline",
  location: "연구관 709호",
  meetingUrl: "",
  slotMinutes: 30,
  maxBookingsPerStudent: 1,
  bookingCloseHours: 0,
  cancelCloseHours: 0,
  audience: "all",
  audienceIds: [],
  ruleType: "recurring",
  recurring: recurring.recurring,
  manualSlots: [],
};

test("recurring slots follow weekday windows, range and exclusions", () => {
  assert.deepEqual(slotTimesForDate(recurring, "2026-12-07"), ["10:00", "10:30", "11:00", "11:30"], "Monday");
  assert.deepEqual(slotTimesForDate(recurring, "2026-12-02"), [], "excluded Wednesday");
  assert.deepEqual(slotTimesForDate(recurring, "2026-12-03"), ["14:00", "14:30"], "Thursday window end is an upper bound");
  assert.deepEqual(slotTimesForDate(recurring, "2026-12-05"), [], "Saturday");
  assert.deepEqual(slotTimesForDate(recurring, "2026-11-30"), [], "before range");
  assert.deepEqual(slotTimesForDate(recurring, "2027-01-04"), [], "after range");
});

test("schedule dates and slot counts cover the whole range", () => {
  const dates = scheduleDates(recurring);
  assert.equal(dates[0], "2026-12-03");
  assert.ok(!dates.includes("2026-12-02"));
  // 12월: 월 4회(7,14,21,28) 수 4회(9,16,23,30; 2일 제외) 목 5회(3,10,17,24,31)
  assert.equal(dates.length, 13);
  assert.equal(countSlots(recurring), 8 * 4 + 2 * 5);
});

test("manual slots are listed per date", () => {
  const manual: SlotConfig = { slotMinutes: 20, ruleType: "manual", recurring: null, manualSlots: ["2026-12-10 09:00", "2026-12-10 13:00", "2026-12-11 10:00"] };
  assert.deepEqual(slotTimesForDate(manual, "2026-12-10"), ["09:00", "13:00"]);
  assert.deepEqual(scheduleDates(manual), ["2026-12-10", "2026-12-11"]);
  assert.equal(countSlots(manual), 3);
});

test("date reasons explain why a date cannot be picked", () => {
  assert.equal(dateUnavailableReason(recurring, "2026-12-07", "2026-12-08"), "지난 날짜");
  assert.equal(dateUnavailableReason(recurring, "2027-01-04", "2026-12-01"), "상담 기간 밖");
  assert.equal(dateUnavailableReason(recurring, "2026-12-02", "2026-12-01"), "상담 제외일");
  assert.equal(dateUnavailableReason(recurring, "2026-12-05", "2026-12-01"), "상담 없는 날");
  assert.equal(dateUnavailableReason(recurring, "2026-12-07", "2026-12-01"), null);
});

test("KST conversions and 5-minute lock blocks", () => {
  const ms = kstInstant("2026-12-07", "10:00");
  assert.equal(new Date(ms).toISOString(), "2026-12-07T01:00:00.000Z");
  assert.deepEqual(kstParts(ms), { date: "2026-12-07", time: "10:00" });
  assert.deepEqual(kstParts(kstInstant("2026-12-07", "23:55")), { date: "2026-12-07", time: "23:55" });
  const blocks = lockBlocks(ms, 30);
  assert.equal(blocks.length, 6);
  assert.equal(blocks[5] - blocks[0], 5);
  // 10:00~10:30과 10:25~10:55는 블록 하나를 공유한다
  const later = lockBlocks(kstInstant("2026-12-07", "10:25"), 30);
  assert.deepEqual(blocks.filter((b) => later.includes(b)).length, 1);
  // 10:30 시작은 겹치지 않는다
  assert.equal(lockBlocks(kstInstant("2026-12-07", "10:30"), 30).filter((b) => blocks.includes(b)).length, 0);
});

test("valid schedule input parses and normalises", () => {
  const r = parseScheduleInput(base);
  assert.ok("data" in r, "error" in r ? r.error : "");
  assert.equal(r.data.title, "중간 면담");
  assert.deepEqual(r.data.manualSlots, []);
});

test("schedule input rejects inconsistent settings", () => {
  const bad = (patch: object, re: RegExp) => {
    const r = parseScheduleInput({ ...base, ...patch });
    assert.ok("error" in r, JSON.stringify(patch));
    assert.match(r.error, re);
  };
  bad({ title: " " }, /일정 이름/);
  bad({ location: "" }, /장소/);
  bad({ mode: "online", meetingUrl: "zoom.us/abc" }, /https/);
  bad({ slotMinutes: 17 }, /5분 단위/);
  bad({ slotMinutes: 0 }, /5분 이상/);
  bad({ audience: "selected", audienceIds: [] }, /학생/);
  bad({ recurring: { ...recurring.recurring, from: "2027-01-01", to: "2026-12-01" } }, /종료일/);
  bad({ recurring: { ...recurring.recurring, from: "2026-01-01", to: "2027-06-01" } }, /366일/);
  bad({ recurring: { ...recurring.recurring, windows: [{ days: [1], start: "10:00", end: "10:00" }] } }, /종료 시각/);
  bad({ recurring: { ...recurring.recurring, windows: [{ days: [1], start: "10:03", end: "11:00" }] } }, /5분 단위/);
  bad({ recurring: { ...recurring.recurring, windows: [{ days: [1, 2], start: "10:00", end: "12:00" }, { days: [2], start: "11:00", end: "13:00" }] } }, /겹칩니다/);
  bad({ recurring: { ...recurring.recurring, windows: [{ days: [6], start: "10:00", end: "12:00" }], from: "2026-12-07", to: "2026-12-11" } }, /상담 시간이 없습니다/);
  bad({ ruleType: "manual", manualSlots: [] }, /하나 이상/);
  bad({ ruleType: "manual", manualSlots: ["2026-12-10 09:00", "2026-12-10 09:20"] }, /겹칩니다/);
  bad({ ruleType: "manual", manualSlots: ["2026-12-10 9:00"] }, /형식/);
});

test("non-overlapping windows on different days are fine and online needs no location", () => {
  const r = parseScheduleInput({
    ...base,
    mode: "online",
    location: "",
    meetingUrl: "https://zoom.us/j/1",
    recurring: { ...recurring.recurring, windows: [{ days: [1], start: "10:00", end: "12:00" }, { days: [1], start: "12:00", end: "13:00" }, { days: [2], start: "11:00", end: "12:00" }] },
  });
  assert.ok("data" in r, "error" in r ? r.error : "");
});

test("selected audience keeps unique ids; switching to all clears them", () => {
  const sel = parseScheduleInput({ ...base, audience: "selected", audienceIds: ["a", "a", "b"] });
  assert.ok("data" in sel);
  assert.deepEqual(sel.data.audienceIds, ["a", "b"]);
  const all = parseScheduleInput({ ...base, audience: "all", audienceIds: ["a"] });
  assert.ok("data" in all);
  assert.deepEqual(all.data.audienceIds, []);
});

test("day slot states mark mine, taken, overlap and closed", () => {
  const date = "2026-12-07";
  const at = (t: string, mins = 30) => ({ start: kstInstant(date, t), end: kstInstant(date, t) + mins * 60_000 });
  const states = daySlotStates({
    cfg: recurring,
    scheduleId: "S",
    date,
    studentId: "me",
    instructorBusy: [
      { ...at("10:00"), scheduleId: "S", studentId: "other", bookingId: "b1" }, // 다른 학생
      { ...at("11:15", 20), scheduleId: "OTHER", studentId: "x", bookingId: "b2" }, // 교수의 다른 일정 (11:00, 11:30 둘 다 겹침)
      { ...at("10:30"), scheduleId: "S", studentId: "me", bookingId: "b3" },
    ],
    myBusy: [{ ...at("10:30"), scheduleId: "S", studentId: "me", bookingId: "b3" }],
    bookingCloseHours: 0,
    now: kstInstant(date, "09:00"),
  });
  assert.deepEqual(states.map((s) => [s.time, s.reason]), [["10:00", "taken"], ["10:30", "mine"], ["11:00", "taken"], ["11:30", "taken"]]);

  const closed = daySlotStates({ cfg: recurring, scheduleId: "S", date, studentId: "me", instructorBusy: [], myBusy: [], bookingCloseHours: 1, now: kstInstant(date, "09:30") });
  assert.deepEqual(closed.map((s) => [s.time, s.available]), [["10:00", false], ["10:30", true], ["11:00", true], ["11:30", true]]);

  const overlap = daySlotStates({
    cfg: recurring, scheduleId: "S", date, studentId: "me",
    instructorBusy: [], myBusy: [{ ...at("10:45"), scheduleId: "OTHER-COURSE", studentId: "me", bookingId: "z" }],
    bookingCloseHours: 0, now: 0,
  });
  assert.deepEqual(overlap.map((s) => s.reason), [null, "overlap", "overlap", null]);

  // 일정 변경 중인 예약 자신은 무시
  const moving = daySlotStates({
    cfg: recurring, scheduleId: "S", date, studentId: "me",
    instructorBusy: [{ ...at("10:30"), scheduleId: "S", studentId: "me", bookingId: "b3" }],
    myBusy: [{ ...at("10:30"), scheduleId: "S", studentId: "me", bookingId: "b3" }],
    bookingCloseHours: 0, now: 0, ignoreBookingId: "b3",
  });
  assert.ok(moving.every((s) => s.available));
});

test("date overrides replace the weekly windows for that date and can add an off day", () => {
  const cfg: SlotConfig = {
    ...recurring,
    recurring: {
      ...recurring.recurring!,
      overrides: [
        { date: "2026-12-09", windows: [{ start: "14:00", end: "15:00" }] }, // 평소 수 10~12 → 14~15
        { date: "2026-12-12", windows: [{ start: "10:00", end: "11:00" }, { start: "13:00", end: "13:30" }] }, // 토요일 추가
      ],
    },
  };
  assert.deepEqual(slotTimesForDate(cfg, "2026-12-09"), ["14:00", "14:30"]);
  assert.deepEqual(slotTimesForDate(cfg, "2026-12-12"), ["10:00", "10:30", "13:00"]);
  assert.deepEqual(slotTimesForDate(cfg, "2026-12-16"), ["10:00", "10:30", "11:00", "11:30"], "other Wednesdays unchanged");
  assert.ok(scheduleDates(cfg).includes("2026-12-12"));
  assert.equal(countSlots(cfg), countSlots(recurring) - 4 + 2 + 3);
  // 예전에 저장된 일정(overrides 없음)도 그대로 동작
  assert.deepEqual(slotTimesForDate({ ...recurring, recurring: { ...recurring.recurring!, overrides: undefined } }, "2026-12-07"), ["10:00", "10:30", "11:00", "11:30"]);
});

test("override input is validated and normalised", () => {
  const withOv = (overrides: unknown) => parseScheduleInput({ ...base, recurring: { ...recurring.recurring, overrides } });
  const ok = withOv([{ date: "2026-12-12", windows: [{ start: "13:00", end: "14:00" }, { start: "10:00", end: "11:00" }] }]);
  assert.ok("data" in ok, "error" in ok ? ok.error : "");
  assert.deepEqual(ok.data.recurring?.overrides?.[0].windows.map((w) => w.start), ["10:00", "13:00"], "windows sorted");
  const bad = (overrides: unknown, re: RegExp) => {
    const r = withOv(overrides);
    assert.ok("error" in r, JSON.stringify(overrides));
    assert.match(r.error, re);
  };
  bad([{ date: "2027-02-01", windows: [{ start: "10:00", end: "11:00" }] }], /상담 기간 안/);
  bad([{ date: "2026-12-02", windows: [{ start: "10:00", end: "11:00" }] }], /제외일/);
  bad([{ date: "2026-12-09", windows: [] }], /하나 이상/);
  bad([{ date: "2026-12-09", windows: [{ start: "10:00", end: "11:00" }, { start: "10:30", end: "12:00" }] }], /겹칩니다/);
  bad([{ date: "2026-12-09", windows: [{ start: "10:00", end: "10:00" }] }], /종료 시각/);
  bad([{ date: "2026-12-09", windows: [{ start: "10:00", end: "11:00" }] }, { date: "2026-12-09", windows: [{ start: "13:00", end: "14:00" }] }], /두 번/);
});
