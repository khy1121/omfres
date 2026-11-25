import { NextResponse } from "next/server";
import { apiCourse } from "@/lib/dal/guard";
import { disableInvite, rotateInvite } from "@/lib/data/courses";
import { parseInviteExpiry } from "@/lib/courses/model";
import { jsonError } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

/** 초대 링크 새로 발급 (이전 링크는 즉시 무효) */
export async function POST(request: Request, { params }: Ctx) {
  const g = await apiCourse(request, (await params).id, { owner: true });
  if ("fail" in g) return g.fail;
  const body = (await request.json().catch(() => null)) as { expiresInDays?: unknown } | null;
  const expiry = parseInviteExpiry(body?.expiresInDays);
  if ("error" in expiry) return jsonError(expiry.error, 400);
  const token = await rotateInvite(g.course.id, g.viewer.uid, expiry.days);
  return NextResponse.json({ token });
}

/** 초대 링크 끄기 */
export async function DELETE(request: Request, { params }: Ctx) {
  const g = await apiCourse(request, (await params).id, { owner: true });
  if ("fail" in g) return g.fail;
  await disableInvite(g.course.id);
  return NextResponse.json({ ok: true });
}
