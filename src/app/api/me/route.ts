import { NextResponse } from "next/server";
import { getViewer, updateProfile } from "@/lib/dal/user";
import { parseProfileInput } from "@/lib/profile";
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

  // 이후 단계(M1): 그룹을 운영 중인 교수가 학생으로 바꾸는 것은 막는다
  await updateProfile(viewer.uid, parsed.data);
  return NextResponse.json({
    ...viewer,
    ...parsed.data,
    isInstructor: parsed.data.accountType === "instructor",
    profileComplete: true,
  });
}
