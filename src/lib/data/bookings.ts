import "server-only";
import { FieldValue, Timestamp, type DocumentReference, type DocumentSnapshot, type Transaction } from "firebase-admin/firestore";
import { db } from "../firebase/admin";
import { hasSlot, isPastDeadline, kstInstant, lockBlocks, addMinutes, type BusyInterval } from "../schedule/rules";
import { isScheduleVisible, scheduleFromDoc, scheduleRef, type Schedule } from "./schedules";

// 예약 데이터 접근 — 동시 예약 방지 (기획안 11장)
//
// bookings/{bookingId}                          예약 (일정·그룹 정보 사본 포함)
// slotLocks/{scheduleId}_{startMs}              같은 일정·같은 시각 1명
// instructorLocks/{instructorId}_{block}        교수자 시간 겹침 방지 (5분 블록)
// studentLocks/{studentId}_{block}              학생 본인 시간 겹침 방지 (5분 블록)
// studentQuota/{scheduleId}_{studentId}         일정별 1인당 예약 횟수
//
// 예약 생성·변경·취소는 모두 한 트랜잭션에서 예약과 잠금을 함께 바꾼다.

export type BookingStatus = "booked" | "cancelled";
export type Actor = { uid: string; as: "student" | "instructor" };

export type Booking = {
  id: string;
  scheduleId: string;
  courseId: string;
  instructorId: string;
  studentId: string;
  studentName: string;
  studentNo: string | null;
  studentEmail: string | null;
  date: string;
  time: string;
  endTime: string;
  slotMinutes: number;
  status: BookingStatus;
  scheduleTitle: string;
  courseTitle: string;
  instructorName: string;
  mode: "offline" | "online";
  location: string;
  meetingUrl: string;
  createdAt: string | null;
  updatedAt: string | null;
  cancelledAt: string | null;
  cancelledBy: "student" | "instructor" | null;
};

export type BookingError =
  | "SCHEDULE_NOT_FOUND"
  | "NOT_OPEN"
  | "NOT_MEMBER"
  | "INVALID_SLOT"
  | "CLOSED"
  | "SLOT_TAKEN"
  | "INSTRUCTOR_BUSY"
  | "STUDENT_OVERLAP"
  | "LIMIT_REACHED"
  | "BOOKING_NOT_FOUND"
  | "FORBIDDEN"
  | "ALREADY_CANCELLED"
  | "CANCEL_CLOSED";

export const BOOKING_ERROR: Record<BookingError, { status: number; message: string }> = {
  SCHEDULE_NOT_FOUND: { status: 404, message: "상담 일정을 찾을 수 없습니다." },
  NOT_OPEN: { status: 409, message: "지금은 예약을 받지 않는 일정입니다." },
  NOT_MEMBER: { status: 403, message: "이 수업 그룹의 학생만 예약할 수 있습니다." },
  INVALID_SLOT: { status: 400, message: "선택한 시간은 이 일정의 상담 시간이 아닙니다." },
  CLOSED: { status: 409, message: "예약 마감 시간이 지났습니다. 다른 시간을 선택해주세요." },
  SLOT_TAKEN: { status: 409, message: "방금 다른 학생이 이 시간을 예약했습니다. 다른 시간을 선택해주세요." },
  INSTRUCTOR_BUSY: { status: 409, message: "이 시간은 교수님의 다른 상담과 겹쳐 예약할 수 없습니다. 다른 시간을 선택해주세요." },
  STUDENT_OVERLAP: { status: 409, message: "내 다른 예약과 시간이 겹칩니다. 다른 시간을 선택해주세요." },
  LIMIT_REACHED: { status: 409, message: "이 일정에서 예약할 수 있는 횟수를 모두 사용했습니다." },
  BOOKING_NOT_FOUND: { status: 404, message: "예약을 찾을 수 없습니다." },
  FORBIDDEN: { status: 403, message: "이 예약을 변경할 권한이 없습니다." },
  ALREADY_CANCELLED: { status: 409, message: "이미 취소된 예약입니다." },
  CANCEL_CLOSED: { status: 409, message: "변경·취소 가능 시간이 지났습니다. 교수님께 직접 문의해주세요." },
};

export class BookingFailure extends Error {
  constructor(public code: BookingError) {
    super(code);
  }
}

const bookings = () => db().collection("bookings");
const slotLockRef = (scheduleId: string, startMs: number) => db().collection("slotLocks").doc(`${scheduleId}_${startMs}`);
const instructorLockRef = (uid: string, block: number) => db().collection("instructorLocks").doc(`${uid}_${block}`);
const studentLockRef = (uid: string, block: number) => db().collection("studentLocks").doc(`${uid}_${block}`);
const quotaRef = (scheduleId: string, studentId: string) => db().collection("studentQuota").doc(`${scheduleId}_${studentId}`);
const memberRef = (courseId: string, uid: string) => db().collection("courses").doc(courseId).collection("members").doc(uid);
const courseRef = (courseId: string) => db().collection("courses").doc(courseId);
const iso = (v: unknown): string | null => (v instanceof Timestamp ? v.toDate().toISOString() : null);

function toBooking(id: string, d: FirebaseFirestore.DocumentData): Booking {
  return {
    id,
    scheduleId: d.scheduleId,
    courseId: d.courseId,
    instructorId: d.instructorId,
    studentId: d.studentId,
    studentName: d.studentName ?? "",
    studentNo: d.studentNo ?? null,
    studentEmail: d.studentEmail ?? null,
    date: d.date,
    time: d.time,
    endTime: d.endTime,
    slotMinutes: d.slotMinutes,
    status: d.status,
    scheduleTitle: d.scheduleTitle ?? "",
    courseTitle: d.courseTitle ?? "",
    instructorName: d.instructorName ?? "",
    mode: d.mode ?? "offline",
    location: d.location ?? "",
    meetingUrl: d.meetingUrl ?? "",
    createdAt: iso(d.createdAt),
    updatedAt: iso(d.updatedAt),
    cancelledAt: iso(d.cancelledAt),
    cancelledBy: d.cancelledBy ?? null,
  };
}

export const bookingStart = (b: Pick<Booking, "date" | "time">) => kstInstant(b.date, b.time);

/** 예약 한 건이 잡는 잠금 문서 목록 */
function lockRefs(scheduleId: string, instructorId: string, studentId: string, startMs: number, minutes: number) {
  const blocks = lockBlocks(startMs, minutes);
  return {
    slot: slotLockRef(scheduleId, startMs),
    instructor: blocks.map((b) => instructorLockRef(instructorId, b)),
    student: blocks.map((b) => studentLockRef(studentId, b)),
  };
}

/** 잠금이 비어 있거나 이 예약 소유인지. 아니면 실패 사유 */
function checkLocks(
  snaps: { slot: DocumentSnapshot; instructor: DocumentSnapshot[]; student: DocumentSnapshot[] },
  studentId: string,
  ownBookingId: string | null,
): BookingError | null {
  const foreign = (s: DocumentSnapshot) => s.exists && s.data()!.bookingId !== ownBookingId;
  if (foreign(snaps.slot)) return "SLOT_TAKEN";
  const busy = snaps.instructor.find(foreign);
  if (busy) return busy.data()!.studentId === studentId ? "STUDENT_OVERLAP" : "INSTRUCTOR_BUSY";
  if (snaps.student.some(foreign)) return "STUDENT_OVERLAP";
  return null;
}

async function readLocks(tx: Transaction, refs: ReturnType<typeof lockRefs>) {
  const all = await tx.getAll(refs.slot, ...refs.instructor, ...refs.student);
  const n = refs.instructor.length;
  return { slot: all[0], instructor: all.slice(1, 1 + n), student: all.slice(1 + n) };
}

function writeLocks(tx: Transaction, refs: ReturnType<typeof lockRefs>, bookingId: string, studentId: string) {
  const data = { bookingId, studentId };
  tx.set(refs.slot, data);
  for (const r of refs.instructor) tx.set(r, data);
  for (const r of refs.student) tx.set(r, data);
}

function deleteOwnedLocks(tx: Transaction, refs: DocumentReference[], snaps: DocumentSnapshot[], bookingId: string, keep: Set<string>) {
  refs.forEach((r, i) => {
    if (keep.has(r.path)) return;
    if (snaps[i].exists && snaps[i].data()!.bookingId === bookingId) tx.delete(r);
  });
}

type StudentInfo = { uid: string; name: string; studentNo: string | null; email: string | null };

/** 예약 생성 (학생 본인) */
export async function createBooking(args: { scheduleId: string; student: StudentInfo; date: string; time: string; now?: number }): Promise<Booking> {
  const { scheduleId, student, date, time } = args;
  const ref = bookings().doc();
  return db().runTransaction(async (tx) => {
    const now = args.now ?? Date.now();
    const sSnap = await tx.get(scheduleRef(scheduleId));
    if (!sSnap.exists) throw new BookingFailure("SCHEDULE_NOT_FOUND");
    const schedule = scheduleFromDoc(sSnap.id, sSnap.data()!);
    const startMs = kstInstant(date, time);
    const refs = lockRefs(scheduleId, schedule.instructorId, student.uid, startMs, schedule.slotMinutes);
    const [member, course, quota] = await tx.getAll(memberRef(schedule.courseId, student.uid), courseRef(schedule.courseId), quotaRef(scheduleId, student.uid));
    const locks = await readLocks(tx, refs);

    if (!member.exists || member.data()!.role !== "student") throw new BookingFailure("NOT_MEMBER");
    if (!isScheduleVisible(schedule, student.uid, "student")) throw new BookingFailure(schedule.status === "open" ? "SCHEDULE_NOT_FOUND" : "NOT_OPEN");
    if (!hasSlot(schedule, date, time)) throw new BookingFailure("INVALID_SLOT");
    if (isPastDeadline(startMs, schedule.bookingCloseHours, now)) throw new BookingFailure("CLOSED");
    const lockError = checkLocks(locks, student.uid, null);
    if (lockError) throw new BookingFailure(lockError);
    const used = quota.exists ? (quota.data()!.count as number) : 0;
    if (used >= schedule.maxBookingsPerStudent) throw new BookingFailure("LIMIT_REACHED");

    const c = course.data() ?? {};
    const data = {
      scheduleId,
      courseId: schedule.courseId,
      instructorId: schedule.instructorId,
      studentId: student.uid,
      studentName: student.name,
      studentNo: student.studentNo,
      studentEmail: student.email,
      date,
      time,
      endTime: addMinutes(time, schedule.slotMinutes),
      startsAt: Timestamp.fromMillis(startMs),
      slotMinutes: schedule.slotMinutes,
      status: "booked" as const,
      scheduleTitle: schedule.title,
      courseTitle: c.title ?? "",
      instructorName: c.ownerName ?? "",
      mode: schedule.mode,
      location: schedule.location,
      meetingUrl: schedule.meetingUrl,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      cancelledAt: null,
      cancelledBy: null,
    };
    tx.set(ref, data);
    writeLocks(tx, refs, ref.id, student.uid);
    tx.set(quotaRef(scheduleId, student.uid), { count: used + 1 });
    return toBooking(ref.id, { ...data, createdAt: Timestamp.fromMillis(now), updatedAt: Timestamp.fromMillis(now) });
  });
}

function assertActor(b: Booking, actor: Actor) {
  if (actor.as === "student" ? b.studentId !== actor.uid : b.instructorId !== actor.uid) throw new BookingFailure("FORBIDDEN");
}

/** 일정 변경 (같은 일정 안에서 시각만 바꾼다). 새 시각을 못 잡으면 기존 예약은 그대로 */
export async function moveBooking(args: { bookingId: string; actor: Actor; date: string; time: string; now?: number }): Promise<Booking> {
  const { bookingId, actor, date, time } = args;
  return db().runTransaction(async (tx) => {
    const now = args.now ?? Date.now();
    const bSnap = await tx.get(bookings().doc(bookingId));
    if (!bSnap.exists) throw new BookingFailure("BOOKING_NOT_FOUND");
    const b = toBooking(bSnap.id, bSnap.data()!);
    assertActor(b, actor);
    if (b.status !== "booked") throw new BookingFailure("ALREADY_CANCELLED");

    const sSnap = await tx.get(scheduleRef(b.scheduleId));
    if (!sSnap.exists) throw new BookingFailure("SCHEDULE_NOT_FOUND");
    const schedule: Schedule = scheduleFromDoc(sSnap.id, sSnap.data()!);

    const oldStart = bookingStart(b);
    const newStart = kstInstant(date, time);
    const oldRefs = lockRefs(b.scheduleId, b.instructorId, b.studentId, oldStart, b.slotMinutes);
    // 새 시각은 현재 일정의 상담 길이로 잡는다
    const newRefs = lockRefs(b.scheduleId, b.instructorId, b.studentId, newStart, schedule.slotMinutes);
    const oldLocks = await readLocks(tx, oldRefs);
    const newLocks = await readLocks(tx, newRefs);

    if (actor.as === "student") {
      if (!isScheduleVisible(schedule, actor.uid, "student")) throw new BookingFailure("NOT_OPEN");
      if (isPastDeadline(oldStart, schedule.cancelCloseHours, now)) throw new BookingFailure("CANCEL_CLOSED");
      if (isPastDeadline(newStart, schedule.bookingCloseHours, now)) throw new BookingFailure("CLOSED");
    } else {
      if (oldStart <= now) throw new BookingFailure("CANCEL_CLOSED");
      if (newStart <= now) throw new BookingFailure("CLOSED");
    }
    if (!hasSlot(schedule, date, time)) throw new BookingFailure("INVALID_SLOT");
    const lockError = checkLocks(newLocks, b.studentId, b.id);
    if (lockError) throw new BookingFailure(lockError);

    const keep = new Set([newRefs.slot, ...newRefs.instructor, ...newRefs.student].map((r) => r.path));
    deleteOwnedLocks(tx, [oldRefs.slot, ...oldRefs.instructor, ...oldRefs.student], [oldLocks.slot, ...oldLocks.instructor, ...oldLocks.student], b.id, keep);
    writeLocks(tx, newRefs, b.id, b.studentId);
    const patch = {
      date,
      time,
      endTime: addMinutes(time, schedule.slotMinutes),
      startsAt: Timestamp.fromMillis(newStart),
      slotMinutes: schedule.slotMinutes,
      updatedAt: FieldValue.serverTimestamp(),
    };
    tx.update(bSnap.ref, patch);
    return { ...b, ...patch, updatedAt: new Date(now).toISOString() };
  });
}

/** 예약 취소. 학생은 취소 마감 전까지, 교수자는 언제든 */
export async function cancelBooking(args: { bookingId: string; actor: Actor; now?: number }): Promise<Booking> {
  const { bookingId, actor } = args;
  return db().runTransaction(async (tx) => {
    const now = args.now ?? Date.now();
    const bSnap = await tx.get(bookings().doc(bookingId));
    if (!bSnap.exists) throw new BookingFailure("BOOKING_NOT_FOUND");
    const b = toBooking(bSnap.id, bSnap.data()!);
    assertActor(b, actor);
    if (b.status !== "booked") throw new BookingFailure("ALREADY_CANCELLED");

    const sSnap = await tx.get(scheduleRef(b.scheduleId));
    const cancelCloseHours = sSnap.exists ? (sSnap.data()!.cancelCloseHours ?? 0) : 0;
    const start = bookingStart(b);
    if (actor.as === "student" && isPastDeadline(start, cancelCloseHours, now)) throw new BookingFailure("CANCEL_CLOSED");

    const refs = lockRefs(b.scheduleId, b.instructorId, b.studentId, start, b.slotMinutes);
    const locks = await readLocks(tx, refs);
    const quota = await tx.get(quotaRef(b.scheduleId, b.studentId));

    deleteOwnedLocks(tx, [refs.slot, ...refs.instructor, ...refs.student], [locks.slot, ...locks.instructor, ...locks.student], b.id, new Set());
    if (quota.exists) tx.set(quota.ref, { count: Math.max(0, (quota.data()!.count as number) - 1) });
    tx.update(bSnap.ref, { status: "cancelled", cancelledAt: FieldValue.serverTimestamp(), cancelledBy: actor.as, updatedAt: FieldValue.serverTimestamp() });
    return { ...b, status: "cancelled" as const, cancelledBy: actor.as, cancelledAt: new Date(now).toISOString() };
  });
}

export async function getBooking(id: string): Promise<Booking | null> {
  if (!id || id.includes("/")) return null;
  const snap = await bookings().doc(id).get();
  return snap.exists ? toBooking(snap.id, snap.data()!) : null;
}

const byStart = (a: Booking, b: Booking) => bookingStart(a) - bookingStart(b);

export async function listBookingsForSchedule(scheduleId: string): Promise<Booking[]> {
  const snap = await bookings().where("scheduleId", "==", scheduleId).get();
  return snap.docs.map((d) => toBooking(d.id, d.data())).sort(byStart);
}

export async function listBookingsForStudent(studentId: string): Promise<Booking[]> {
  const snap = await bookings().where("studentId", "==", studentId).get();
  return snap.docs.map((d) => toBooking(d.id, d.data())).sort(byStart);
}

export async function listBookingsForInstructor(instructorId: string): Promise<Booking[]> {
  const snap = await bookings().where("instructorId", "==", instructorId).where("status", "==", "booked").get();
  return snap.docs.map((d) => toBooking(d.id, d.data())).sort(byStart);
}

export async function listBookingsForCourse(courseId: string): Promise<Booking[]> {
  const snap = await bookings().where("courseId", "==", courseId).get();
  return snap.docs.map((d) => toBooking(d.id, d.data())).sort(byStart);
}

type Busy = BusyInterval & { bookingId: string };

function toBusy(d: FirebaseFirestore.QueryDocumentSnapshot): Busy {
  const x = d.data();
  const start = kstInstant(x.date, x.time);
  return { start, end: start + x.slotMinutes * 60_000, scheduleId: x.scheduleId, studentId: x.studentId, bookingId: d.id };
}

/** 그날 교수자의 모든 예약과 학생 본인의 모든 예약 (슬롯 상태 계산용) */
export async function busyOnDate(instructorId: string, studentId: string, date: string): Promise<{ instructorBusy: Busy[]; myBusy: Busy[] }> {
  const [ins, mine] = await Promise.all([
    bookings().where("instructorId", "==", instructorId).where("date", "==", date).where("status", "==", "booked").get(),
    bookings().where("studentId", "==", studentId).where("date", "==", date).where("status", "==", "booked").get(),
  ]);
  return { instructorBusy: ins.docs.map(toBusy), myBusy: mine.docs.map(toBusy) };
}

/** 이 일정에서 학생이 쓴 예약 횟수 */
export async function quotaUsed(scheduleId: string, studentId: string): Promise<number> {
  const snap = await quotaRef(scheduleId, studentId).get();
  return snap.exists ? (snap.data()!.count as number) : 0;
}

/** 그룹에서 제외·탈퇴한 학생의 예정된 예약을 모두 취소 (교수자 권한으로) */
export type BulkCancelResult = { cancelled: number; failed: { bookingId: string; date: string; time: string }[] };

/** 일시적인 오류(트랜잭션 경합·시간 초과·일시 장애)인지 — 이런 경우만 다시 시도한다 */
const isTransient = (e: unknown) => [4, 10, 14].includes((e as { code?: unknown })?.code as number);

/**
 * 그룹에서 제외·탈퇴한 학생의 예정된 예약을 모두 취소 (교수자 권한으로).
 * 일시적인 오류는 몇 번 다시 시도하고, 끝내 취소하지 못한 예약은 따로 돌려준다 (호출한 쪽에서 안내).
 */
export async function cancelUpcomingForStudentInCourse(
  courseId: string,
  studentId: string,
  instructorId: string,
  { retries = 3, backoffMs = 200 } = {},
): Promise<BulkCancelResult> {
  const now = Date.now();
  const snap = await bookings().where("courseId", "==", courseId).where("studentId", "==", studentId).where("status", "==", "booked").get();
  const result: BulkCancelResult = { cancelled: 0, failed: [] };
  for (const d of snap.docs) {
    const { date, time } = d.data() as { date: string; time: string };
    if (kstInstant(date, time) <= now) continue;
    for (let attempt = 1; ; attempt++) {
      try {
        await cancelBooking({ bookingId: d.id, actor: { uid: instructorId, as: "instructor" } });
        result.cancelled++;
        break;
      } catch (e) {
        // 그사이 이미 취소·삭제된 예약은 목표를 이룬 것으로 보고 넘어간다
        if (e instanceof BookingFailure && (e.code === "ALREADY_CANCELLED" || e.code === "BOOKING_NOT_FOUND")) break;
        if (isTransient(e) && attempt < retries) {
          await new Promise((r) => setTimeout(r, backoffMs * attempt));
          continue;
        }
        result.failed.push({ bookingId: d.id, date, time });
        break;
      }
    }
  }
  return result;
}
