import "server-only";
import { getViewer, type Viewer } from "./user";
import { getCourseAccess, type Course } from "../data/courses";
import { isSameOrigin, jsonError } from "../http";
import type { CourseRole } from "../courses/model";

// API 공통 검사. 실패하면 바로 반환할 응답을, 성공하면 확인된 값을 돌려준다.

type Fail = { fail: Response };

export async function apiViewer(request: Request, { mutate = true } = {}): Promise<Fail | { viewer: Viewer }> {
  if (mutate && !isSameOrigin(request)) return { fail: jsonError("허용되지 않은 요청입니다.", 403) };
  const viewer = await getViewer();
  if (!viewer) return { fail: jsonError("로그인이 필요합니다.", 401) };
  return { viewer };
}

/** 그룹 멤버인지(필요하면 교수자인지) 확인. 멤버가 아니면 그룹 존재 여부도 알려주지 않는다(404) */
export async function apiCourse(
  request: Request,
  courseId: string,
  { owner = false, mutate = true } = {},
): Promise<Fail | { viewer: Viewer; course: Course; role: CourseRole }> {
  const v = await apiViewer(request, { mutate });
  if ("fail" in v) return v;
  const access = await getCourseAccess(courseId, v.viewer.uid);
  if (!access) return { fail: jsonError("수업 그룹을 찾을 수 없습니다.", 404) };
  if (owner && (access.role !== "owner" || !v.viewer.isInstructor)) return { fail: jsonError("교수자만 할 수 있습니다.", 403) };
  return { viewer: v.viewer, ...access };
}
