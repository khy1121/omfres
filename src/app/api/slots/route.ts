import { NextRequest, NextResponse } from "next/server";
import { generateTimeSlots, isDateSelectable, nowTimeKST, todayKST } from "@/lib/config";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") ?? "";
  if (!isDateSelectable(date)) {
    return NextResponse.json({ error: "예약할 수 없는 날짜입니다." }, { status: 400 });
  }
  const booked = new Set(await getStore().bookedTimes(date));
  const now = date === todayKST() ? nowTimeKST() : "00:00";
  const slots = generateTimeSlots().map((time) => ({
    time,
    available: !booked.has(time) && time > now,
  }));
  return NextResponse.json({ date, slots });
}
