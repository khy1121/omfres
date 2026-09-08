import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getProfessor } from "@/lib/config";
import { validateName, validateSlot, validateStudentId } from "@/lib/validate";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** 본인 확인: 학번 + 이름이 예약과 일치해야 함 */
async function authorize(id: string, studentId: unknown, name: unknown) {
  const sid = validateStudentId(studentId);
  const nm = validateName(name);
  if (!sid || !nm) return { error: "학번과 이름을 정확히 입력해주세요.", status: 400 } as const;
  const r = await getStore().get(id);
  if (!r || r.studentId !== sid || r.name !== nm) {
    return { error: "예약을 찾을 수 없습니다.", status: 404 } as const;
  }
  return { reservation: r } as const;
}

/** 예약 수정 (날짜/시간 변경) */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  let body: { studentId?: string; name?: string; date?: string; time?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const auth = await authorize(id, body.studentId, body.name);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const prof = getProfessor(auth.reservation.professorId);
  if (!prof) return NextResponse.json({ error: "교수님 정보를 찾을 수 없습니다." }, { status: 400 });
  const slotError = validateSlot(prof, body.date, body.time);
  if (slotError) return NextResponse.json({ error: slotError }, { status: 400 });
  const date = String(body.date);
  const time = String(body.time);

  if (auth.reservation.date === date && auth.reservation.time === time) {
    return NextResponse.json({ reservation: auth.reservation });
  }
  const ok = await getStore().move(id, date, time);
  if (!ok) return NextResponse.json({ error: "이미 예약된 시간입니다. 다른 시간을 선택해주세요." }, { status: 409 });
  return NextResponse.json({ reservation: await getStore().get(id) });
}

/** 예약 취소 */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const sp = req.nextUrl.searchParams;
  const auth = await authorize(id, sp.get("studentId"), sp.get("name"));
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  await getStore().remove(id);
  return NextResponse.json({ ok: true });
}
