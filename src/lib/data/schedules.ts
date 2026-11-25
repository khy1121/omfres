import "server-only";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db } from "../firebase/admin";
import { kstInstant, type ScheduleInput } from "../schedule/rules";
import type { CourseRole } from "../courses/model";

// 상담 일정 데이터 접근. 호출하는 쪽에서 그룹 멤버·교수자 여부를 먼저 확인한다.
// schedules/{scheduleId}

export type ScheduleStatus = "draft" | "open" | "closed";

export type Schedule = ScheduleInput & {
  id: string;
  courseId: string;
  instructorId: string;
  status: ScheduleStatus;
  createdAt: string | null;
  updatedAt: string | null;
};

const schedules = () => db().collection("schedules");
const iso = (v: unknown): string | null => (v instanceof Timestamp ? v.toDate().toISOString() : null);

function toSchedule(id: string, d: FirebaseFirestore.DocumentData): Schedule {
  return {
    id,
    courseId: d.courseId,
    instructorId: d.instructorId,
    status: d.status,
    title: d.title,
    description: d.description ?? "",
    mode: d.mode,
    location: d.location ?? "",
    meetingUrl: d.meetingUrl ?? "",
    slotMinutes: d.slotMinutes,
    bufferMinutes: d.bufferMinutes ?? 0,
    maxPerDay: d.maxPerDay ?? 0,
    maxBookingsPerStudent: d.maxBookingsPerStudent ?? 1,
    bookingCloseHours: d.bookingCloseHours ?? 0,
    cancelCloseHours: d.cancelCloseHours ?? 0,
    audience: d.audience ?? "all",
    audienceIds: d.audienceIds ?? [],
    ruleType: d.ruleType,
    recurring: d.recurring ?? null,
    manualSlots: d.manualSlots ?? [],
    createdAt: iso(d.createdAt),
    updatedAt: iso(d.updatedAt),
  };
}

export { toSchedule as scheduleFromDoc };

export function scheduleRef(id: string) {
  return schedules().doc(id);
}

/** 학생에게 보이는 일정인지 (교수자는 자기 그룹의 모든 일정을 본다) */
export function isScheduleVisible(s: Pick<Schedule, "status" | "audience" | "audienceIds">, uid: string, role: CourseRole): boolean {
  if (role === "owner") return true;
  return s.status === "open" && (s.audience === "all" || s.audienceIds.includes(uid));
}

export async function createSchedule(courseId: string, instructorId: string, input: ScheduleInput, status: ScheduleStatus): Promise<string> {
  const ref = schedules().doc();
  await ref.set({
    ...input,
    courseId,
    instructorId,
    status,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

/** 그룹에 속한 일정만 돌려준다 (다른 그룹 일정 ID로 접근 방지) */
export async function getScheduleInCourse(courseId: string, scheduleId: string): Promise<Schedule | null> {
  if (!scheduleId || scheduleId.includes("/")) return null;
  const snap = await scheduleRef(scheduleId).get();
  if (!snap.exists || snap.data()!.courseId !== courseId) return null;
  return toSchedule(snap.id, snap.data()!);
}

export async function getSchedulesByIds(ids: string[]): Promise<Map<string, Schedule>> {
  const unique = [...new Set(ids)].filter((id) => id && !id.includes("/"));
  if (!unique.length) return new Map();
  const snaps = await db().getAll(...unique.map((id) => scheduleRef(id)));
  return new Map(snaps.filter((s) => s.exists).map((s) => [s.id, toSchedule(s.id, s.data()!)]));
}

export async function listSchedules(courseId: string): Promise<Schedule[]> {
  const snap = await schedules().where("courseId", "==", courseId).get();
  return snap.docs.map((d) => toSchedule(d.id, d.data())).sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
}

/**
 * 일정 수정. 예정된 예약에 저장된 일정 정보(이름·방식·장소·주소)도 함께 갱신한다.
 * 예약 시각과 길이는 예약 시점 값으로 고정되어 바뀌지 않는다.
 */
export async function updateSchedule(scheduleId: string, input: ScheduleInput) {
  await scheduleRef(scheduleId).update({ ...input, updatedAt: FieldValue.serverTimestamp() });
  const now = Date.now();
  const booked = await db().collection("bookings").where("scheduleId", "==", scheduleId).where("status", "==", "booked").get();
  const upcoming = booked.docs.filter((d) => kstInstant(d.data().date, d.data().time) > now);
  for (let i = 0; i < upcoming.length; i += 400) {
    const batch = db().batch();
    for (const d of upcoming.slice(i, i + 400)) {
      batch.update(d.ref, { scheduleTitle: input.title, mode: input.mode, location: input.location, meetingUrl: input.meetingUrl });
    }
    await batch.commit();
  }
}

export async function setScheduleStatus(scheduleId: string, status: ScheduleStatus) {
  await scheduleRef(scheduleId).update({ status, updatedAt: FieldValue.serverTimestamp() });
}

/**
 * 예정된 예약이 없을 때만 삭제한다.
 *
 * 확인과 삭제 사이에 학생이 예약하는 경합을 막기 위해 먼저 일정을 "마감"으로 바꾼다.
 * 예약 트랜잭션은 일정 문서를 읽으므로, 상태 변경이 커밋된 뒤의 예약은 재시도되어 거부된다.
 * 그래서 상태를 바꾼 다음 조회한 예약 목록에는 그 전에 커밋된 예약이 빠짐없이 들어 있다.
 * 예정 예약이 있으면 원래 상태로 되돌린다.
 */
export async function deleteSchedule(scheduleId: string): Promise<"deleted" | "has_bookings" | "not_found"> {
  const ref = scheduleRef(scheduleId);
  const previous = await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const status = snap.data()!.status as ScheduleStatus;
    if (status !== "closed") tx.update(ref, { status: "closed", updatedAt: FieldValue.serverTimestamp() });
    return status;
  });
  if (previous === null) return "not_found";

  const now = Date.now();
  const booked = await db().collection("bookings").where("scheduleId", "==", scheduleId).where("status", "==", "booked").get();
  if (booked.docs.some((d) => kstInstant(d.data().date, d.data().time) > now)) {
    // 삭제하지 않으므로 상태를 되돌린다 (그사이 교수자가 상태를 바꿨다면 그 값을 존중)
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists && snap.data()!.status === "closed" && previous !== "closed") {
        tx.update(ref, { status: previous, updatedAt: FieldValue.serverTimestamp() });
      }
    });
    return "has_bookings";
  }
  await ref.delete();
  return "deleted";
}
