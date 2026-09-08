import { NextRequest, NextResponse } from "next/server";
import { getStore, Reservation } from "@/lib/store";
import { validateName, validateSlot, validateStudentId } from "@/lib/validate";

export const dynamic = "force-dynamic";

/** 예약 조회: ?studentId=&name= (학번 + 이름 일치 시에만 반환) */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const studentId = validateStudentId(sp.get("studentId"));
  const name = validateName(sp.get("name"));
  if (!studentId || !name) {
    return NextResponse.json({ error: "학번과 이름을 정확히 입력해주세요." }, { status: 400 });
  }
  const rows = (await getStore().listByStudent(studentId))
    .filter((r) => r.name === name)
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  return NextResponse.json({ reservations: rows });
}

/** 예약 생성 */
export async function POST(req: NextRequest) {
  let body: Partial<Reservation>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const slotError = validateSlot(body.date, body.time);
  if (slotError) return NextResponse.json({ error: slotError }, { status: 400 });
  const studentId = validateStudentId(body.studentId);
  if (!studentId) return NextResponse.json({ error: "학번은 6~10자리 숫자로 입력해주세요." }, { status: 400 });
  const name = validateName(body.name);
  if (!name) return NextResponse.json({ error: "이름은 2~20자로 입력해주세요." }, { status: 400 });

  const reservation: Reservation = {
    id: crypto.randomUUID(),
    date: String(body.date),
    time: String(body.time),
    studentId,
    name,
    createdAt: new Date().toISOString(),
  };

  const ok = await getStore().create(reservation);
  if (!ok) {
    return NextResponse.json(
      { error: "방금 다른 사람이 예약한 시간입니다. 다른 시간을 선택해주세요." },
      { status: 409 },
    );
  }
  return NextResponse.json({ reservation }, { status: 201 });
}
