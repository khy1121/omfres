import { NextRequest, NextResponse } from "next/server";
import { createSession, isValidPin, verifyPin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { pin?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (!isValidPin(body.pin)) return NextResponse.json({ error: "PIN은 6자리 숫자입니다." }, { status: 400 });
  if (!(await verifyPin(body.pin))) return NextResponse.json({ error: "PIN이 올바르지 않습니다." }, { status: 401 });
  await createSession();
  return NextResponse.json({ ok: true });
}
