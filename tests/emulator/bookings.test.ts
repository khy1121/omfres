// 예약 동시성·잠금 통합 테스트 — `npm run test:emulator`로만 실행한다.
import { before, test } from "node:test";
import assert from "node:assert/strict";
import "./guard";
import { joinAsStudent } from "./seed";
import * as courses from "../../src/lib/data/courses";
import * as schedules from "../../src/lib/data/schedules";
import * as bookings from "../../src/lib/data/bookings";
import { db } from "../../src/lib/firebase/admin";
import { kstInstant, parseScheduleInput, type ScheduleInput } from "../../src/lib/schedule/rules";

const prof = { uid: "bk-prof", name: "김교수", email: "prof@hansung.ac.kr", studentNo: null };
const students = Array.from({ length: 20 }, (_, i) => ({ uid: `bk-s${i}`, name: `학생${i}`, email: `s${i}@x.com`, studentNo: `2071${String(i).padStart(3, "0")}` }));
const NOW = kstInstant("2026-12-01", "09:00");
const DAY = "2026-12-07"; // 월요일

function input(patch: { [K in keyof ScheduleInput]?: unknown } = {}): ScheduleInput {
  const r = parseScheduleInput({
    title: "면담",
    description: "",
    mode: "offline",
    location: "709호",
    meetingUrl: "",
    slotMinutes: 30,
    maxBookingsPerStudent: 1,
    bookingCloseHours: 0,
    cancelCloseHours: 0,
    audience: "all",
    audienceIds: [],
    ruleType: "recurring",
    recurring: { from: "2026-12-01", to: "2027-03-31", windows: [{ days: [1], start: "10:00", end: "12:00" }], excludeDates: [] },
    manualSlots: [],
    ...patch,
  });
  if ("error" in r) throw new Error(r.error);
  return r.data;
}

let courseA = "";
let courseB = "";

async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "OK";
  } catch (e) {
    if (e instanceof bookings.BookingFailure) return e.code;
    throw e;
  }
}

before(async () => {
  await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${process.env.FIREBASE_PROJECT_ID}/databases/(default)/documents`, { method: "DELETE" });
  courseA = await courses.createCourse(prof, { title: "자료구조", term: "2026년 2학기", description: "" });
  courseB = await courses.createCourse(prof, { title: "운영체제", term: "2026년 2학기", description: "" });
  const tokA = (await courses.getCourse(courseA))!.currentInvite!.token;
  const tokB = (await courses.getCourse(courseB))!.currentInvite!.token;
  for (const s of students) {
    await joinAsStudent(tokA, s);
    await joinAsStudent(tokB, s);
  }
});

const student = (i: number) => ({ uid: students[i].uid, name: students[i].name, studentNo: students[i].studentNo, email: students[i].email });

test("20 students racing for the same slot: exactly one wins", async () => {
  const sid = await schedules.createSchedule(courseA, prof.uid, input(), "open");
  const results = await Promise.all(students.map((_, i) => codeOf(bookings.createBooking({ scheduleId: sid, student: student(i), date: DAY, time: "10:00", now: NOW }))));
  assert.equal(results.filter((r) => r === "OK").length, 1, JSON.stringify(results));
  assert.ok(results.filter((r) => r !== "OK").every((r) => r === "SLOT_TAKEN"));
  const list = await bookings.listBookingsForSchedule(sid);
  assert.equal(list.filter((b) => b.status === "booked").length, 1);
});

test("different slots of the same schedule can be booked concurrently", async () => {
  const sid = await schedules.createSchedule(courseA, prof.uid, input(), "open");
  const times = ["10:00", "10:30", "11:00", "11:30"];
  const results = await Promise.all(times.map((t, i) => codeOf(bookings.createBooking({ scheduleId: sid, student: student(i), date: "2026-12-14", time: t, now: NOW }))));
  assert.deepEqual(results, ["OK", "OK", "OK", "OK"]);
});

test("overlapping slots in two courses of the same instructor: only one can be booked", async () => {
  const s1 = await schedules.createSchedule(courseA, prof.uid, input(), "open");
  // 다른 수업, 15분 어긋난 시간대 (10:15~10:45 이 10:00~10:30, 10:30~11:00과 겹침)
  const s2 = await schedules.createSchedule(courseB, prof.uid, input({ recurring: { from: "2026-12-01", to: "2026-12-31", windows: [{ days: [1], start: "10:15", end: "11:15" }], excludeDates: [] } }), "open");
  const results = await Promise.all([
    codeOf(bookings.createBooking({ scheduleId: s1, student: student(0), date: "2026-12-21", time: "10:00", now: NOW })),
    codeOf(bookings.createBooking({ scheduleId: s2, student: student(1), date: "2026-12-21", time: "10:15", now: NOW })),
  ]);
  assert.equal(results.filter((r) => r === "OK").length, 1, JSON.stringify(results));
  assert.ok(results.includes("INSTRUCTOR_BUSY"));
  // 겹치지 않는 시각은 가능
  assert.equal(await codeOf(bookings.createBooking({ scheduleId: s2, student: student(2), date: "2026-12-21", time: "10:45", now: NOW })), "OK");
});

test("a student cannot hold two overlapping bookings across instructors", async () => {
  const other = { uid: "bk-prof2", name: "이교수", email: "p2@hansung.ac.kr", studentNo: null };
  const courseC = await courses.createCourse(other, { title: "네트워크", term: "2026년 2학기", description: "" });
  await joinAsStudent((await courses.getCourse(courseC))!.currentInvite!.token, students[5]);
  const s1 = await schedules.createSchedule(courseA, prof.uid, input(), "open");
  const s2 = await schedules.createSchedule(courseC, other.uid, input(), "open");
  assert.equal(await codeOf(bookings.createBooking({ scheduleId: s1, student: student(5), date: "2026-12-28", time: "11:00", now: NOW })), "OK");
  assert.equal(await codeOf(bookings.createBooking({ scheduleId: s2, student: student(5), date: "2026-12-28", time: "11:00", now: NOW })), "STUDENT_OVERLAP");
  assert.equal(await codeOf(bookings.createBooking({ scheduleId: s2, student: student(5), date: "2026-12-28", time: "11:30", now: NOW })), "OK");
});

test("per-student limit holds under concurrent requests", async () => {
  const sid = await schedules.createSchedule(courseA, prof.uid, input({ maxBookingsPerStudent: 2 }), "open");
  const times = ["10:00", "10:30", "11:00", "11:30"];
  const results = await Promise.all(times.map((t) => codeOf(bookings.createBooking({ scheduleId: sid, student: student(7), date: "2027-01-04", time: t, now: NOW }))));
  // 같은 학생이라 학생 잠금은 서로 다르지만 횟수 문서를 공유한다
  assert.equal(results.filter((r) => r === "OK").length, 2, JSON.stringify(results));
  assert.ok(results.filter((r) => r !== "OK").every((r) => r === "LIMIT_REACHED"));
  assert.equal(await bookings.quotaUsed(sid, students[7].uid), 2);
});

test("rules: deadline, invalid slot, closed schedule, audience and membership", async () => {
  const sid = await schedules.createSchedule(courseA, prof.uid, input({ bookingCloseHours: 24 }), "open");
  const s = student(8);
  assert.equal(await codeOf(bookings.createBooking({ scheduleId: sid, student: s, date: "2026-12-07", time: "10:00", now: kstInstant("2026-12-06", "10:01") })), "CLOSED");
  assert.equal(await codeOf(bookings.createBooking({ scheduleId: sid, student: s, date: "2026-12-07", time: "10:10", now: NOW })), "INVALID_SLOT");
  assert.equal(await codeOf(bookings.createBooking({ scheduleId: sid, student: s, date: "2026-12-08", time: "10:00", now: NOW })), "INVALID_SLOT");

  const draft = await schedules.createSchedule(courseA, prof.uid, input(), "draft");
  assert.equal(await codeOf(bookings.createBooking({ scheduleId: draft, student: s, date: DAY, time: "10:00", now: NOW })), "NOT_OPEN");

  const only9 = await schedules.createSchedule(courseA, prof.uid, input({ audience: "selected", audienceIds: [students[9].uid] }), "open");
  assert.equal(await codeOf(bookings.createBooking({ scheduleId: only9, student: s, date: "2027-01-11", time: "11:30", now: NOW })), "SCHEDULE_NOT_FOUND");
  assert.equal(await codeOf(bookings.createBooking({ scheduleId: only9, student: student(9), date: "2027-01-11", time: "11:30", now: NOW })), "OK");

  const outsider = { uid: "bk-outsider", name: "외부인", studentNo: "1", email: null };
  assert.equal(await codeOf(bookings.createBooking({ scheduleId: sid, student: outsider, date: "2026-12-14", time: "10:00", now: NOW })), "NOT_MEMBER");
});

test("moving keeps the old booking when the new slot is taken, and frees the old slot on success", async () => {
  const sid = await schedules.createSchedule(courseA, prof.uid, input(), "open");
  const day = "2027-01-18";
  const a = await bookings.createBooking({ scheduleId: sid, student: student(10), date: day, time: "10:00", now: NOW });
  await bookings.createBooking({ scheduleId: sid, student: student(11), date: day, time: "10:30", now: NOW });

  assert.equal(await codeOf(bookings.moveBooking({ bookingId: a.id, actor: { uid: students[10].uid, as: "student" }, date: day, time: "10:30", now: NOW })), "SLOT_TAKEN");
  assert.equal((await bookings.getBooking(a.id))?.time, "10:00", "unchanged after failed move");

  // 15분 겹치는 자기 자신과의 이동(다른 일정 길이)도 자기 잠금은 무시
  const moved = await bookings.moveBooking({ bookingId: a.id, actor: { uid: students[10].uid, as: "student" }, date: day, time: "11:00", now: NOW });
  assert.equal(moved.time, "11:00");
  // 비워진 10:00은 다른 학생이 예약 가능
  assert.equal(await codeOf(bookings.createBooking({ scheduleId: sid, student: student(12), date: day, time: "10:00", now: NOW })), "OK");
  // 다른 학생은 남의 예약을 옮길 수 없다
  assert.equal(await codeOf(bookings.moveBooking({ bookingId: a.id, actor: { uid: students[12].uid, as: "student" }, date: day, time: "11:30", now: NOW })), "FORBIDDEN");
  // 교수자는 옮길 수 있다
  assert.equal((await bookings.moveBooking({ bookingId: a.id, actor: { uid: prof.uid, as: "instructor" }, date: day, time: "11:30", now: NOW })).time, "11:30");
});

test("cancelling frees every lock and the quota; student cancel respects the deadline", async () => {
  const sid = await schedules.createSchedule(courseA, prof.uid, input({ cancelCloseHours: 2 }), "open");
  const day = "2027-01-25";
  const b = await bookings.createBooking({ scheduleId: sid, student: student(13), date: day, time: "11:00", now: NOW });
  assert.equal(await codeOf(bookings.cancelBooking({ bookingId: b.id, actor: { uid: students[13].uid, as: "student" }, now: kstInstant(day, "09:30") })), "CANCEL_CLOSED");
  assert.equal(await codeOf(bookings.cancelBooking({ bookingId: b.id, actor: { uid: students[14].uid, as: "student" }, now: NOW })), "FORBIDDEN");
  const c = await bookings.cancelBooking({ bookingId: b.id, actor: { uid: students[13].uid, as: "student" }, now: NOW });
  assert.equal(c.status, "cancelled");
  assert.equal(await codeOf(bookings.cancelBooking({ bookingId: b.id, actor: { uid: students[13].uid, as: "student" }, now: NOW })), "ALREADY_CANCELLED");
  assert.equal(await bookings.quotaUsed(sid, students[13].uid), 0);
  const locks = await Promise.all(["slotLocks", "instructorLocks", "studentLocks"].map((c) => db().collection(c).where("bookingId", "==", b.id).get()));
  assert.deepEqual(locks.map((l) => l.size), [0, 0, 0]);
  // 같은 시간 재예약 가능
  assert.equal(await codeOf(bookings.createBooking({ scheduleId: sid, student: student(14), date: day, time: "11:00", now: NOW })), "OK");
});

test("removing a student from a course cancels their upcoming bookings there", async () => {
  const sid = await schedules.createSchedule(courseB, prof.uid, input(), "open");
  // 실제 현재 시각 기준 미래여야 하므로 내년 날짜를 쓴다
  const future = await schedules.createSchedule(courseB, prof.uid, input({ recurring: { from: "2027-12-01", to: "2027-12-31", windows: [{ days: [1], start: "10:00", end: "12:00" }], excludeDates: [] } }), "open");
  const b = await bookings.createBooking({ scheduleId: future, student: student(15), date: "2027-12-06", time: "10:00" });
  assert.ok(sid);
  // 취소에 실패한 예약은 성공으로 세지 않고 따로 돌려준다 (여기서는 권한 없는 교수자로 시도)
  const denied = await bookings.cancelUpcomingForStudentInCourse(courseB, students[15].uid, "not-the-owner", { backoffMs: 1 });
  assert.equal(denied.cancelled, 0);
  assert.deepEqual(denied.failed.map((f) => f.bookingId), [b.id]);
  assert.equal((await bookings.getBooking(b.id))?.status, "booked", "still booked after a failed attempt");

  const ok = await bookings.cancelUpcomingForStudentInCourse(courseB, students[15].uid, prof.uid);
  assert.deepEqual(ok, { cancelled: 1, failed: [] });
  assert.equal((await bookings.getBooking(b.id))?.status, "cancelled");

  // 다시 실행해도 이미 취소된 예약은 대상이 아니다
  assert.deepEqual(await bookings.cancelUpcomingForStudentInCourse(courseB, students[15].uid, prof.uid), { cancelled: 0, failed: [] });
});

test("busyOnDate returns instructor-wide and personal bookings for slot states", async () => {
  const day = "2026-12-21";
  const { instructorBusy, myBusy } = await bookings.busyOnDate(prof.uid, students[14].uid, day);
  assert.ok(instructorBusy.length >= 1);
  assert.ok(myBusy.every((b) => b.studentId === students[14].uid));
});

test("deleting a schedule with upcoming bookings is refused and the schedule reopens", async () => {
  const sid = await schedules.createSchedule(courseA, prof.uid, input(), "open");
  await bookings.createBooking({ scheduleId: sid, student: student(16), date: "2027-02-01", time: "10:00" });
  assert.equal(await schedules.deleteSchedule(sid), "has_bookings");
  assert.equal((await schedules.getScheduleInCourse(courseA, sid))?.status, "open", "status restored");

  const empty = await schedules.createSchedule(courseA, prof.uid, input(), "draft");
  assert.equal(await schedules.deleteSchedule(empty), "deleted");
  assert.equal(await schedules.getScheduleInCourse(courseA, empty), null);
  assert.equal(await schedules.deleteSchedule(empty), "not_found");
});

test("deleting while students book never leaves bookings on a deleted schedule", async () => {
  for (let round = 0; round < 5; round++) {
    const sid = await schedules.createSchedule(courseA, prof.uid, input(), "open");
    const date = "2027-02-08";
    const times = ["10:00", "10:30", "11:00", "11:30"];
    const [del, ...rs] = await Promise.all([
      schedules.deleteSchedule(sid),
      ...times.map((t, i) => codeOf(bookings.createBooking({ scheduleId: sid, student: student(16 + i), date, time: t }))),
    ]);
    const exists = await schedules.getScheduleInCourse(courseA, sid);
    const booked = (await bookings.listBookingsForSchedule(sid)).filter((b) => b.status === "booked");
    if (del === "deleted") {
      assert.equal(exists, null);
      assert.equal(booked.length, 0, `round ${round}: bookings left on a deleted schedule (${rs.join(",")})`);
    } else {
      assert.equal(del, "has_bookings");
      assert.equal(exists?.status, "open", `round ${round}: status restored`);
      assert.ok(booked.length > 0);
    }
    // 다음 라운드를 위해 이번 라운드 예약 정리 (교수 잠금이 같은 시각을 막지 않도록)
    for (const b of booked) await bookings.cancelBooking({ bookingId: b.id, actor: { uid: prof.uid, as: "instructor" } });
  }
});

test("profile changes update upcoming bookings but keep past and cancelled records", async () => {
  const sid = await schedules.createSchedule(courseA, prof.uid, input({ maxBookingsPerStudent: 3 }), "open");
  const s = student(17);
  // 과거 시점(NOW)에 예약한 것처럼 만든 '지난 상담'
  const past = await bookings.createBooking({ scheduleId: sid, student: s, date: "2026-12-28", time: "10:00", now: NOW });
  const upcoming = await bookings.createBooking({ scheduleId: sid, student: s, date: "2027-02-15", time: "10:00" });
  const cancelled = await bookings.createBooking({ scheduleId: sid, student: s, date: "2027-02-15", time: "11:00" });
  await bookings.cancelBooking({ bookingId: cancelled.id, actor: { uid: s.uid, as: "student" } });

  const n = await bookings.syncStudentOnUpcomingBookings(s.uid, "새이름", "2079999", kstInstant("2027-01-01", "00:00"));
  assert.equal(n, 1);
  assert.deepEqual([(await bookings.getBooking(upcoming.id))?.studentName, (await bookings.getBooking(upcoming.id))?.studentNo], ["새이름", "2079999"]);
  assert.equal((await bookings.getBooking(past.id))?.studentName, s.name, "past record kept");
  assert.equal((await bookings.getBooking(cancelled.id))?.studentName, s.name, "cancelled record kept");
  // 바뀐 것이 없으면 다시 쓰지 않는다
  assert.equal(await bookings.syncStudentOnUpcomingBookings(s.uid, "새이름", "2079999", kstInstant("2027-01-01", "00:00")), 0);
});

test("bookings follow date overrides: new hours bookable, usual hours refused that day", async () => {
  const sid = await schedules.createSchedule(
    courseA,
    prof.uid,
    input({
      recurring: {
        from: "2026-12-01",
        to: "2027-03-31",
        windows: [{ days: [1], start: "10:00", end: "12:00" }],
        excludeDates: [],
        overrides: [
          { date: "2027-03-01", windows: [{ start: "15:00", end: "16:00" }] }, // 월요일 시간 변경
          { date: "2027-03-06", windows: [{ start: "09:00", end: "09:30" }] }, // 토요일 추가
        ],
      },
    }),
    "open",
  );
  const s = student(18);
  assert.equal(await codeOf(bookings.createBooking({ scheduleId: sid, student: s, date: "2027-03-01", time: "10:00" })), "INVALID_SLOT", "usual hours replaced");
  assert.equal(await codeOf(bookings.createBooking({ scheduleId: sid, student: s, date: "2027-03-06", time: "09:00" })), "OK", "added Saturday");
  const other = student(19);
  assert.equal(await codeOf(bookings.createBooking({ scheduleId: sid, student: other, date: "2027-03-01", time: "15:30" })), "OK", "override hours");
});
