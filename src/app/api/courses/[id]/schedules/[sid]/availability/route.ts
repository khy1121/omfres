import { NextResponse } from "next/server";
import { slotContext } from "@/lib/dal/slot-context";
import { upcomingBusyByDate } from "@/lib/data/bookings";
import { availabilitySummary } from "@/lib/schedule/rules";
import { kstToday } from "@/lib/kst";

/**
 * 일정 전체 기간의 날짜별 예약 가능 시간 수와 가장 빠른 시간 (달력 표시용)
 * GET [?booking=예약ID] — 예약을 옮기는 상황이면 그 예약과의 겹침은 무시한다
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string; sid: string }> }) {
  const { id, sid } = await params;
  const c = await slotContext(request, id, sid);
  if ("fail" in c) return c.fail;

  const now = Date.now();
  const today = kstToday(now);
  const busy = await upcomingBusyByDate(c.schedule.instructorId, c.studentId, today);
  const summary = availabilitySummary({
    cfg: c.schedule,
    scheduleId: c.schedule.id,
    studentId: c.studentId,
    today,
    ...busy,
    bookingCloseHours: c.bookingCloseHours,
    now,
    ignoreBookingId: c.ignoreBookingId,
  });
  return NextResponse.json(summary);
}
