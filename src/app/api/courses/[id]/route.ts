import { NextResponse } from "next/server";
import { apiCourse } from "@/lib/dal/guard";
import { updateCourse } from "@/lib/data/courses";
import { parseCourseInput } from "@/lib/courses/model";
import { jsonError } from "@/lib/http";

/** 그룹 정보 수정 (교수자) */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await apiCourse(request, (await params).id, { owner: true });
  if ("fail" in g) return g.fail;
  const parsed = parseCourseInput(await request.json().catch(() => null));
  if ("error" in parsed) return jsonError(parsed.error, 400);
  await updateCourse(g.course.id, parsed.data);
  return NextResponse.json({ ok: true });
}
