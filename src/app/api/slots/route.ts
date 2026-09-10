import { NextRequest, NextResponse } from "next/server";
import { generateTimeSlots, isDateSelectable, nowTimeKST, todayKST } from "@/lib/config";
import { validateProfessor } from "@/lib/validate";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/** ?professor=&date= → 해당 교수님/날짜의 슬롯과 예약 가능 여부 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const prof = await validateProfessor(sp.get("professor"));
  if (!prof) return NextResponse.json({ error: "교수님을 선택해주세요." }, { status: 400 });
  const date = sp.get("date") ?? "";
  if (!isDateSelectable(prof, date)) {
    return NextResponse.json({ error: "예약할 수 없는 날짜입니다." }, { status: 400 });
  }
  const booked = new Set(await getStore().bookedTimes(prof.id, date));
  const now = date === todayKST() ? nowTimeKST() : "00:00";
  const slots = generateTimeSlots(prof, date).map((time) => ({
    time,
    available: !booked.has(time) && time > now,
  }));
  return NextResponse.json({ professor: prof.id, date, slotMinutes: prof.slotMinutes, slots });
}
