import { NextResponse } from "next/server";
import { slotContext } from "@/lib/dal/slot-context";
import { busyOnDate, quotaUsed } from "@/lib/data/bookings";
import { daySlotStates, isValidDate } from "@/lib/schedule/rules";
import { jsonError } from "@/lib/http";

/**
 * 날짜별 슬롯 상태
 * GET ?date=YYYY-MM-DD[&booking=예약ID]
 * booking을 주면 그 예약을 옮기는 상황으로 계산한다 (학생 본인 또는 교수자)
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string; sid: string }> }) {
  const { id, sid } = await params;
  const c = await slotContext(request, id, sid);
  if ("fail" in c) return c.fail;

  const date = new URL(request.url).searchParams.get("date");
  if (!isValidDate(date)) return jsonError("날짜 형식이 올바르지 않습니다.", 400);

  const { instructorBusy, myBusy } = await busyOnDate(c.schedule.instructorId, c.studentId, date);
  const slots = daySlotStates({
    cfg: c.schedule,
    scheduleId: c.schedule.id,
    date,
    studentId: c.studentId,
    instructorBusy,
    myBusy,
    bookingCloseHours: c.bookingCloseHours,
    now: Date.now(),
    ignoreBookingId: c.ignoreBookingId,
  });
  const used = c.role === "student" ? await quotaUsed(c.schedule.id, c.viewer.uid) : 0;
  return NextResponse.json({ date, slots, quota: { used, max: c.schedule.maxBookingsPerStudent } });
}
