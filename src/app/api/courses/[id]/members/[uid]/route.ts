import { NextResponse } from "next/server";
import { apiCourse } from "@/lib/dal/guard";
import { removeStudent } from "@/lib/data/courses";
import { cancelUpcomingForStudentInCourse } from "@/lib/data/bookings";
import { jsonError } from "@/lib/http";

/** 학생 제외(교수자) 또는 그룹 나가기(학생 본인) */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; uid: string }> }) {
  const { id, uid } = await params;
  const g = await apiCourse(request, id);
  if ("fail" in g) return g.fail;

  const self = uid === g.viewer.uid;
  const ownerAction = g.role === "owner" && g.viewer.isInstructor;
  if (!self && !ownerAction) return jsonError("교수자만 다른 멤버를 제외할 수 있습니다.", 403);

  const result = await removeStudent(id, uid);
  if (result === "is_owner") return jsonError("교수자는 그룹에서 나가거나 제외될 수 없습니다.", 400);
  if (result === "not_member") return jsonError("이미 그룹에 없는 멤버입니다.", 404);
  // 그룹을 떠난 학생의 예정된 상담은 취소해 시간을 비운다
  // 끝내 취소하지 못한 예약은 응답에 담아 교수자가 직접 정리할 수 있게 한다
  const { cancelled, failed } = await cancelUpcomingForStudentInCourse(id, uid, g.course.ownerId);
  return NextResponse.json({ ok: true, cancelled, failed });
}
