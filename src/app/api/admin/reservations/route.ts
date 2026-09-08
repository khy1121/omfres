import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { getStore } from "@/lib/store";

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
