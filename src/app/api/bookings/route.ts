import { NextResponse } from "next/server";
import { apiViewer } from "@/lib/dal/guard";
import { createBooking, listBookingsForStudent } from "@/lib/data/bookings";
import { bookingErrorResponse } from "@/lib/dal/booking-errors";
import { isValidDate, isValidTime } from "@/lib/schedule/rules";
import { jsonError } from "@/lib/http";

/** 내 예약 목록 (학생). scheduleId로 좁힐 수 있다 — 응답 유실 후 결과 확인용 */
export async function GET(request: Request) {
  const v = await apiViewer(request, { mutate: false });
  if ("fail" in v) return v.fail;
  const scheduleId = new URL(request.url).searchParams.get("scheduleId");
  const all = await listBookingsForStudent(v.viewer.uid);
  return NextResponse.json({ bookings: scheduleId ? all.filter((b) => b.scheduleId === scheduleId) : all });
}

/** 예약하기 (학생) */
export async function POST(request: Request) {
  const v = await apiViewer(request);
  if ("fail" in v) return v.fail;
  const { viewer } = v;
  if (viewer.accountType !== "student" || !viewer.studentNo) return jsonError("학생 계정만 예약할 수 있습니다. 내 정보를 확인해주세요.", 403);

  const body = (await request.json().catch(() => null)) as { scheduleId?: unknown; date?: unknown; time?: unknown } | null;
  if (typeof body?.scheduleId !== "string" || !isValidDate(body.date) || !isValidTime(body.time)) return jsonError("예약할 날짜와 시간을 선택해주세요.", 400);

  try {
    const booking = await createBooking({
      scheduleId: body.scheduleId,
      student: { uid: viewer.uid, name: viewer.name, studentNo: viewer.studentNo, email: viewer.email },
      date: body.date,
      time: body.time,
    });
    return NextResponse.json({ booking }, { status: 201 });
  } catch (e) {
    return bookingErrorResponse(e);
  }
}
