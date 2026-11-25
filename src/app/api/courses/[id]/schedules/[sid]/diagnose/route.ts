import { NextResponse } from "next/server";
import { apiCourse } from "@/lib/dal/guard";
import { getScheduleInCourse } from "@/lib/data/schedules";
import { bookingStart, listBookingsForInstructor } from "@/lib/data/bookings";
import { diagnoseDate } from "@/lib/schedule/diagnose";
import { isValidDate } from "@/lib/schedule/rules";
import { jsonError } from "@/lib/http";

/**
 * 교수용 날짜 진단: 그날 시간마다 예약 가능 여부와 이유
 * GET ?date=YYYY-MM-DD (그룹 교수자만. 학생 이름·다른 수업 이름이 들어가므로 학생에게는 열지 않는다)
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string; sid: string }> }) {
  const { id, sid } = await params;
  const g = await apiCourse(request, id, { owner: true, mutate: false });
  if ("fail" in g) return g.fail;
  const schedule = await getScheduleInCourse(id, sid);
  if (!schedule) return jsonError("상담 일정을 찾을 수 없습니다.", 404);
  const date = new URL(request.url).searchParams.get("date");
  if (!isValidDate(date)) return jsonError("날짜 형식이 올바르지 않습니다.", 400);

  const all = await listBookingsForInstructor(schedule.instructorId);
  const bookings = all
    .filter((b) => b.date === date)
    .map((b) => {
      const start = bookingStart(b);
      const end = start + b.slotMinutes * 60_000;
      return {
        start,
        end,
        holdEnd: end + (b.bufferMinutes ?? 0) * 60_000,
        scheduleId: b.scheduleId,
        label:
          b.scheduleId === schedule.id
            ? `${b.studentName}${b.studentNo ? ` ${b.studentNo}` : ""} · ${b.time}~${b.endTime}`
            : `${b.courseTitle} · ${b.scheduleTitle} (${b.time}~${b.endTime})`,
      };
    });
  const now = Date.now();
  return NextResponse.json(diagnoseDate({ cfg: schedule, scheduleId: schedule.id, date, now, bookings }));
}
