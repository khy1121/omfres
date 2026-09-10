import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { getStore } from "@/lib/store";
import { validateProfessorInput } from "@/lib/validate";

export const dynamic = "force-dynamic";

/** 교수님(상담자) 목록 */
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  return NextResponse.json({ professors: await getStore().getProfessors() });
}

/** 교수님 추가 */
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const id = `p${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
  const v = validateProfessorInput(id, body);
  if ("error" in v) return NextResponse.json({ error: v.error }, { status: 400 });
  const store = getStore();
  const list = await store.getProfessors();
  const next = [...list, v.prof];
  await store.setProfessors(next);
  return NextResponse.json({ professor: v.prof, professors: next }, { status: 201 });
}
