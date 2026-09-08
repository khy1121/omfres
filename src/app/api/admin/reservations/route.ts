import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { getStore, Reservation } from "@/lib/store";
import { validateName, validateProfessor, validateSlot } from "@/lib/validate";

export const dynamic = "force-dynamic";

/** 전체 예약 조회. ?name= 으로 학생별 필터 */
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const name = req.nextUrl.searchParams.get("name")?.trim();
  const rows = (name ? await getStore().listByName(name) : await getStore().listAll()).sort((a, b) =>
    `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`),
  );
  return NextResponse.json({ reservations: rows });
}

/** 관리자 예약 추가 */
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  let body: Partial<Reservation>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const prof = validateProfessor(body.professorId);
  if (!prof) return NextResponse.json({ error: "교수님을 선택해주세요." }, { status: 400 });
  const slotError = validateSlot(prof, body.date, body.time);
  if (slotError) return NextResponse.json({ error: slotError }, { status: 400 });
  const name = validateName(body.name);
  if (!name) return NextResponse.json({ error: "이름은 2~20자로 입력해주세요." }, { status: 400 });

  const reservation: Reservation = {
    id: crypto.randomUUID(),
    professorId: prof.id,
    date: String(body.date),
    time: String(body.time),
    name,
    createdAt: new Date().toISOString(),
  };
  const ok = await getStore().create(reservation);
  if (!ok) return NextResponse.json({ error: "이미 예약된 시간입니다." }, { status: 409 });
  return NextResponse.json({ reservation }, { status: 201 });
}
