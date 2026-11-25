import { NextResponse } from "next/server";
import { getViewer, updateProfile } from "@/lib/dal/user";
import { parseProfileInput } from "@/lib/profile";
import { hasAnyMembership } from "@/lib/data/courses";
import { isSameOrigin, jsonError } from "@/lib/http";

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return jsonError("로그인이 필요합니다.", 401);
  return NextResponse.json(viewer);
}

/** 프로필 저장: 계정 유형(교수/학생), 이름, 학번(학생만 필수). 교수는 학교 계정만 선택 가능 */
export async function PUT(request: Request) {
  if (!isSameOrigin(request)) return jsonError("허용되지 않은 요청입니다.", 403);
  const viewer = await getViewer();
  if (!viewer) return jsonError("로그인이 필요합니다.", 401);

  const parsed = parseProfileInput(await request.json().catch(() => null), viewer.instructorEligible);
  if ("error" in parsed) return jsonError(parsed.error, 400);

  // 그룹에서의 역할(교수자/학생)과 계정 유형이 어긋나지 않도록, 그룹이 있으면 유형 변경을 막는다
  if (viewer.accountType && viewer.accountType !== parsed.data.accountType && (await hasAnyMembership(viewer.uid))) {
    return jsonError(
      viewer.accountType === "instructor"
        ? "운영 중인 수업 그룹이 있어 학생으로 바꿀 수 없습니다."
        : "참여 중인 수업 그룹이 있어 교수로 바꿀 수 없습니다. 그룹에서 나간 뒤 다시 시도해주세요.",
      409,
    );
  }
  await updateProfile(viewer.uid, parsed.data);
  return NextResponse.json({
    ...viewer,
    ...parsed.data,
    isInstructor: parsed.data.accountType === "instructor",
    profileComplete: true,
  });
}
