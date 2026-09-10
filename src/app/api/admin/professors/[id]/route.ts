import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { getStore } from "@/lib/store";
import { validateProfessorInput } from "@/lib/validate";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** 교수님 프로필/제약조건 수정 */
export async function PUT(req: NextRequest, { params }: Ctx) {
  if (!(await isAdmin())) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const store = getStore();
  const list = await store.getProfessors();
  if (!list.some((p) => p.id === id)) return NextResponse.json({ error: "교수님을 찾을 수 없습니다." }, { status: 404 });
  const v = validateProfessorInput(id, body);
  if ("error" in v) return NextResponse.json({ error: v.error }, { status: 400 });
  const next = list.map((p) => (p.id === id ? v.prof : p));
  await store.setProfessors(next);
  return NextResponse.json({ professor: v.prof, professors: next });
}

/** 교수님 삭제. 기존 예약은 그대로 남으며 목록에서 이름 대신 ID로 표시됨 */
export async function DELETE(_req: Request, { params }: Ctx) {
  if (!(await isAdmin())) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { id } = await params;
  const store = getStore();
  const list = await store.getProfessors();
  if (!list.some((p) => p.id === id)) return NextResponse.json({ error: "교수님을 찾을 수 없습니다." }, { status: 404 });
  const next = list.filter((p) => p.id !== id);
  await store.setProfessors(next);
  return NextResponse.json({ ok: true, professors: next });
}
