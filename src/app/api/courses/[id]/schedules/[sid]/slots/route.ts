import { NextResponse } from "next/server";
import { apiCourse } from "@/lib/dal/guard";
import { getScheduleInCourse, isScheduleVisible } from "@/lib/data/schedules";
import { busyOnDate, getBooking, quotaUsed } from "@/lib/data/bookings";
import { daySlotStates, isValidDate } from "@/lib/schedule/rules";
import { jsonError } from "@/lib/http";
import { effectiveCourseRole } from "@/lib/courses/model";

/**
 * 날짜별 슬롯 상태
 * GET ?date=YYYY-MM-DD[&booking=예약ID]
 * booking을 주면 그 예약을 옮기는 상황으로 계산한다 (학생 본인 또는 교수자)
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string; sid: string }> }) {
  const { id, sid } = await params;
  const g = await apiCourse(request, id, { mutate: false });
  if ("fail" in g) return g.fail;
  // 개설자라도 현재 교수 자격이 없으면 학생과 같은 기준을 적용한다
  const role = effectiveCourseRole(g.role, g.viewer.isInstructor);
  const schedule = await getScheduleInCourse(id, sid);
  if (!schedule || !isScheduleVisible(schedule, g.viewer.uid, role)) return jsonError("상담 일정을 찾을 수 없습니다.", 404);

  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  if (!isValidDate(date)) return jsonError("날짜 형식이 올바르지 않습니다.", 400);

  let studentId = g.viewer.uid;
  let ignore: string | null = null;
  const bookingId = url.searchParams.get("booking");
  if (bookingId) {
    const b = await getBooking(bookingId);
    const allowed = b && b.scheduleId === schedule.id && (b.studentId === g.viewer.uid || (role === "owner" && b.instructorId === g.viewer.uid));
    if (!allowed) return jsonError("예약을 찾을 수 없습니다.", 404);
    studentId = b.studentId;
    ignore = b.id;
  }

  const { instructorBusy, myBusy } = await busyOnDate(schedule.instructorId, studentId, date);
  const slots = daySlotStates({
    cfg: schedule,
    scheduleId: schedule.id,
    date,
    studentId,
    instructorBusy,
    myBusy,
    // 교수자가 옮길 때는 학생용 예약 마감을 적용하지 않는다 (지난 시각만 막음)
    bookingCloseHours: role === "owner" ? 0 : schedule.bookingCloseHours,
    now: Date.now(),
    ignoreBookingId: ignore,
  });
  const used = role === "student" ? await quotaUsed(schedule.id, g.viewer.uid) : 0;
  return NextResponse.json({ date, slots, quota: { used, max: schedule.maxBookingsPerStudent } });
}
