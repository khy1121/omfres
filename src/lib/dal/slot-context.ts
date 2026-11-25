import "server-only";
import { apiCourse } from "./guard";
import { getScheduleInCourse, isScheduleVisible, type Schedule } from "../data/schedules";
import { getBooking } from "../data/bookings";
import { jsonError } from "../http";
import { effectiveCourseRole, type CourseRole } from "../courses/model";
import type { Viewer } from "./user";

export type SlotContext = {
  viewer: Viewer;
  role: CourseRole;
  schedule: Schedule;
  /** 슬롯 계산에 쓸 일정 설정 (교수자가 옮길 때는 하루 최대를 적용하지 않음 — 예약 트랜잭션과 같은 기준) */
  cfg: Schedule;
  /** 슬롯 상태를 계산할 학생 (예약 이동이면 그 예약의 학생) */
  studentId: string;
  /** 이동 중인 예약 (자기 자신과의 겹침은 무시) */
  ignoreBookingId: string | null;
  /** 학생용 예약 마감 (교수자가 옮길 때는 지난 시각만 막는다) */
  bookingCloseHours: number;
};

/**
 * 슬롯·남은 수 조회 공통 검사: 그룹 멤버, 일정 공개 여부(교수 자격 반영),
 * ?booking=예약ID 이면 그 예약을 옮길 권한(학생 본인 또는 담당 교수자).
 */
export async function slotContext(request: Request, courseId: string, scheduleId: string): Promise<{ fail: Response } | SlotContext> {
  const g = await apiCourse(request, courseId, { mutate: false });
  if ("fail" in g) return g;
  // 개설자라도 현재 교수 자격이 없으면 학생과 같은 기준을 적용한다
  const role = effectiveCourseRole(g.role, g.viewer.isInstructor);
  const schedule = await getScheduleInCourse(courseId, scheduleId);
  if (!schedule || !isScheduleVisible(schedule, g.viewer.uid, role)) return { fail: jsonError("상담 일정을 찾을 수 없습니다.", 404) };

  let studentId = g.viewer.uid;
  let ignoreBookingId: string | null = null;
  const bookingId = new URL(request.url).searchParams.get("booking");
  if (bookingId) {
    const b = await getBooking(bookingId);
    const allowed = b && b.scheduleId === schedule.id && (b.studentId === g.viewer.uid || (role === "owner" && b.instructorId === g.viewer.uid));
    if (!allowed) return { fail: jsonError("예약을 찾을 수 없습니다.", 404) };
    studentId = b.studentId;
    ignoreBookingId = b.id;
  }
  return {
    viewer: g.viewer,
    role,
    schedule,
    cfg: role === "owner" ? { ...schedule, maxPerDay: 0 } : schedule,
    studentId,
    ignoreBookingId,
    bookingCloseHours: role === "owner" ? 0 : schedule.bookingCloseHours,
  };
}
