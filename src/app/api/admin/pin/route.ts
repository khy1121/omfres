import { NextRequest, NextResponse } from "next/server";
import { changePin, isAdmin, isValidPin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  let body: { currentPin?: unknown; newPin?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (!isValidPin(body.currentPin) || !isValidPin(body.newPin)) {
    return NextResponse.json({ error: "PIN은 6자리 숫자입니다." }, { status: 400 });
  }
  if (body.currentPin === body.newPin) {
    return NextResponse.json({ error: "새 PIN이 현재 PIN과 같습니다." }, { status: 400 });
  }
  const ok = await changePin(body.currentPin, body.newPin);
  if (!ok) return NextResponse.json({ error: "현재 PIN이 올바르지 않습니다." }, { status: 401 });
  return NextResponse.json({ ok: true });
}
