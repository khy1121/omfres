import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/** 관리자 예약 삭제 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { id } = await params;
  const store = getStore();
  if (!(await store.get(id))) return NextResponse.json({ error: "예약을 찾을 수 없습니다." }, { status: 404 });
  await store.remove(id);
  return NextResponse.json({ ok: true });
}
