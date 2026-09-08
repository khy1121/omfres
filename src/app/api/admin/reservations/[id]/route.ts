import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { getProfessor } from "@/lib/config";
import { getStore } from "@/lib/store";
import { validateSlot } from "@/lib/validate";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** 관리자 예약 이동 (같은 교수님 내 날짜/시간 변경) */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  if (!(await isAdmin())) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { id } = await params;
  let body: { date?: string; time?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const store = getStore();
  const r = await store.get(id);
  if (!r) return NextResponse.json({ error: "예약을 찾을 수 없습니다." }, { status: 404 });
  const prof = getProfessor(r.professorId);
  if (!prof) return NextResponse.json({ error: "교수님 정보를 찾을 수 없습니다." }, { status: 400 });
  const slotError = validateSlot(prof, body.date, body.time);
  if (slotError) return NextResponse.json({ error: slotError }, { status: 400 });
  const date = String(body.date);
  const time = String(body.time);
  if (r.date === date && r.time === time) return NextResponse.json({ reservation: r });
  const ok = await store.move(id, date, time);
  if (!ok) return NextResponse.json({ error: "이미 예약된 시간입니다." }, { status: 409 });
  return NextResponse.json({ reservation: await store.get(id) });
}

/** 관리자 예약 삭제 */
export async function DELETE(_req: Request, { params }: Ctx) {
  if (!(await isAdmin())) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { id } = await params;
  const store = getStore();
  if (!(await store.get(id))) return NextResponse.json({ error: "예약을 찾을 수 없습니다." }, { status: 404 });
  await store.remove(id);
  return NextResponse.json({ ok: true });
}
