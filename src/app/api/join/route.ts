import { NextResponse } from "next/server";
import { apiViewer } from "@/lib/dal/guard";
import { joinByInvite } from "@/lib/data/courses";
import { INVITE_STATUS_MESSAGE, isInviteTokenFormat } from "@/lib/courses/model";
import { jsonError } from "@/lib/http";

/** 초대 링크로 수업 그룹 참여 (학생) */
export async function POST(request: Request) {
  const v = await apiViewer(request);
  if ("fail" in v) return v.fail;
  const { viewer } = v;

  const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
  if (!isInviteTokenFormat(body?.token)) return jsonError(INVITE_STATUS_MESSAGE.not_found, 404, "not_found");
  if (viewer.accountType !== "student" || !viewer.profileComplete || !viewer.studentNo) {
    return jsonError(
      viewer.accountType === "instructor" ? "교수 계정은 학생으로 참여할 수 없습니다." : "내 정보에서 이름과 학번을 먼저 입력해주세요.",
      400,
      viewer.accountType === "instructor" ? "instructor" : "profile_incomplete",
    );
  }

  const result = await joinByInvite(body.token, { uid: viewer.uid, name: viewer.name, email: viewer.email, studentNo: viewer.studentNo });
  if (!result.ok) return jsonError(INVITE_STATUS_MESSAGE[result.status], result.status === "not_found" ? 404 : 410, result.status);
  return NextResponse.json({ courseId: result.courseId, already: result.already });
}
