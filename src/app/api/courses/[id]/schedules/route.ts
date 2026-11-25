import { NextResponse } from "next/server";
import { apiCourse } from "@/lib/dal/guard";
import { listMembers } from "@/lib/data/courses";
import { createSchedule } from "@/lib/data/schedules";
import { parseScheduleInput } from "@/lib/schedule/rules";
import { jsonError } from "@/lib/http";

/** 상담 일정 만들기 (교수자). status: draft(초안) | open(공개) */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await apiCourse(request, (await params).id, { owner: true });
  if ("fail" in g) return g.fail;
  const body = (await request.json().catch(() => null)) as { schedule?: unknown; status?: unknown } | null;
  const parsed = parseScheduleInput(body?.schedule);
  if ("error" in parsed) return jsonError(parsed.error, 400);
  const status = body?.status === "draft" ? "draft" : "open";

  if (parsed.data.audience === "selected") {
    const students = new Set((await listMembers(g.course.id)).filter((m) => m.role === "student").map((m) => m.uid));
    if (parsed.data.audienceIds.some((id) => !students.has(id))) return jsonError("그룹에 없는 학생이 대상에 포함되어 있습니다.", 400);
  }

  const id = await createSchedule(g.course.id, g.viewer.uid, parsed.data, status);
  return NextResponse.json({ id }, { status: 201 });
}
