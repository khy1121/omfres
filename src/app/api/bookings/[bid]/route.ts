import { NextResponse } from "next/server";
import { apiViewer } from "@/lib/dal/guard";
import { cancelBooking, getBooking, moveBooking, type Actor } from "@/lib/data/bookings";
import { bookingErrorResponse } from "@/lib/dal/booking-errors";
import { isValidDate, isValidTime } from "@/lib/schedule/rules";
import { jsonError } from "@/lib/http";
import type { Viewer } from "@/lib/dal/user";

type Ctx = { params: Promise<{ bid: string }> };

/** 요청자가 이 예약의 학생 본인인지, 담당 교수자인지 */
async function actorFor(viewer: Viewer, bookingId: string): Promise<Actor | null> {
  const b = await getBooking(bookingId);
  if (!b) return null;
  if (b.studentId === viewer.uid) return { uid: viewer.uid, as: "student" };
  if (b.instructorId === viewer.uid && viewer.isInstructor) return { uid: viewer.uid, as: "instructor" };
  return null;
}

/** 일정 변경 (같은 일정 안에서 날짜·시간) */
export async function PATCH(request: Request, { params }: Ctx) {
  const v = await apiViewer(request);
  if ("fail" in v) return v.fail;
  const { bid } = await params;
  const actor = await actorFor(v.viewer, bid);
  if (!actor) return jsonError("예약을 찾을 수 없습니다.", 404);

  const body = (await request.json().catch(() => null)) as { date?: unknown; time?: unknown } | null;
  if (!isValidDate(body?.date) || !isValidTime(body?.time)) return jsonError("변경할 날짜와 시간을 선택해주세요.", 400);
  try {
    return NextResponse.json({ booking: await moveBooking({ bookingId: bid, actor, date: body.date, time: body.time }) });
  } catch (e) {
    return bookingErrorResponse(e);
  }
}

/** 예약 취소 */
export async function DELETE(request: Request, { params }: Ctx) {
  const v = await apiViewer(request);
  if ("fail" in v) return v.fail;
  const { bid } = await params;
  const actor = await actorFor(v.viewer, bid);
  if (!actor) return jsonError("예약을 찾을 수 없습니다.", 404);
  try {
    return NextResponse.json({ booking: await cancelBooking({ bookingId: bid, actor }) });
  } catch (e) {
    return bookingErrorResponse(e);
  }
}
