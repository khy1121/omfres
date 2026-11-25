import { NextResponse } from "next/server";
import { apiCourse } from "@/lib/dal/guard";
import { listMembers } from "@/lib/data/courses";
import { deleteSchedule, getScheduleInCourse, setScheduleStatus, updateSchedule } from "@/lib/data/schedules";
import { listBookingsForSchedule } from "@/lib/data/bookings";
import { parseScheduleInput } from "@/lib/schedule/rules";
import { scheduleImpact } from "@/lib/schedule/impact";
import { jsonError } from "@/lib/http";

type Ctx = { params: Promise<{ id: string; sid: string }> };

async function load(request: Request, ctx: Ctx) {
  const { id, sid } = await ctx.params;
  const g = await apiCourse(request, id, { owner: true });
  if ("fail" in g) return g;
  const schedule = await getScheduleInCourse(id, sid);
  if (!schedule) return { fail: jsonError("상담 일정을 찾을 수 없습니다.", 404) };
  return { ...g, schedule };
}

/**
 * 일정 수정 (교수자)
 * - { status }                      공개 상태만 변경
 * - { schedule, dryRun: true }      저장하지 않고 영향받는 예약만 확인
 * - { schedule }                    저장
 */
export async function PATCH(request: Request, ctx: Ctx) {
  const g = await load(request, ctx);
  if ("fail" in g) return g.fail;
  const body = (await request.json().catch(() => null)) as { status?: unknown; schedule?: unknown; dryRun?: unknown } | null;

  if (body?.status !== undefined && body.schedule === undefined) {
    if (body.status !== "draft" && body.status !== "open" && body.status !== "closed") return jsonError("상태 값이 올바르지 않습니다.", 400);
    await setScheduleStatus(g.schedule.id, body.status);
    return NextResponse.json({ ok: true });
  }

  const parsed = parseScheduleInput(body?.schedule);
  if ("error" in parsed) return jsonError(parsed.error, 400);
  if (parsed.data.audience === "selected") {
    const students = new Set((await listMembers(g.course.id)).filter((m) => m.role === "student").map((m) => m.uid));
    if (parsed.data.audienceIds.some((id) => !students.has(id))) return jsonError("그룹에 없는 학생이 대상에 포함되어 있습니다.", 400);
  }

  const impact = scheduleImpact(parsed.data, await listBookingsForSchedule(g.schedule.id), Date.now());
  if (body?.dryRun === true) return NextResponse.json({ impact });
  await updateSchedule(g.schedule.id, parsed.data);
  return NextResponse.json({ ok: true, impact });
}

/** 일정 삭제 (예정된 예약이 없을 때만) */
export async function DELETE(request: Request, ctx: Ctx) {
  const g = await load(request, ctx);
  if ("fail" in g) return g.fail;
  const r = await deleteSchedule(g.schedule.id);
  if (r === "has_bookings") return jsonError("예정된 예약이 있어 삭제할 수 없습니다. 예약을 취소하거나 일정을 마감해주세요.", 409);
  return NextResponse.json({ ok: true });
}
