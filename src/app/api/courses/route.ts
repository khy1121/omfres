import { NextResponse } from "next/server";
import { apiViewer } from "@/lib/dal/guard";
import { createCourse } from "@/lib/data/courses";
import { parseCourseInput } from "@/lib/courses/model";
import { jsonError } from "@/lib/http";

/** 수업 그룹 만들기 (교수 계정만). 만들면 초대 링크가 함께 발급된다 */
export async function POST(request: Request) {
  const v = await apiViewer(request);
  if ("fail" in v) return v.fail;
  const { viewer } = v;
  if (!viewer.isInstructor) return jsonError("교수 계정만 수업 그룹을 만들 수 있습니다.", 403);
  if (!viewer.profileComplete) return jsonError("내 정보에서 이름을 먼저 입력해주세요.", 400);

  const parsed = parseCourseInput(await request.json().catch(() => null));
  if ("error" in parsed) return jsonError(parsed.error, 400);

  const id = await createCourse({ uid: viewer.uid, name: viewer.name, email: viewer.email, studentNo: null }, parsed.data);
  return NextResponse.json({ id }, { status: 201 });
}
