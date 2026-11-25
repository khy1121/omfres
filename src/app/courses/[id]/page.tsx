import { Icon } from "@iconify/react";
import Link from "next/link";
import { notFound } from "next/navigation";
import CourseSettings from "@/components/courses/CourseSettings";
import InviteCard from "@/components/courses/InviteCard";
import LeaveButton from "@/components/courses/LeaveButton";
import { BackLink } from "@/components/courses/BackLink";
import { Card } from "@/components/ui";
import { requireViewer } from "@/lib/dal/user";
import { countStudents, getCourseAccess } from "@/lib/data/courses";

export const dynamic = "force-dynamic";

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireViewer(`/courses/${id}`);
  const access = await getCourseAccess(id, viewer.uid);
  if (!access) notFound();
  const { course, role } = access;
  const isOwner = role === "owner" && viewer.isInstructor;

  const header = (
    <header className="mb-6">
      <BackLink href="/courses" label="내 수업" />
      <h1 className="mt-2 text-2xl font-bold tracking-tight">{course.title}</h1>
      <p className="mt-1 text-sm text-neutral-500">
        {course.term} · {course.ownerName} 교수{course.ownerEmail ? ` (${course.ownerEmail})` : ""}
      </p>
      {course.description && <p className="mt-3 whitespace-pre-wrap text-sm text-neutral-700">{course.description}</p>}
    </header>
  );

  const schedulesPlaceholder = (
    <Card>
      <h2 className="mb-1 flex items-center gap-2 text-lg font-bold tracking-tight">
        <Icon icon="lucide:calendar-days" width={18} />
        상담 일정
      </h2>
      <p className="text-sm text-neutral-500">
        {isOwner ? "상담 일정 등록은 다음 업데이트에서 제공됩니다." : "교수님이 상담 일정을 열면 여기에 표시됩니다."}
      </p>
    </Card>
  );

  if (!isOwner) {
    return (
      <main className="px-4 py-8">
        <div className="mx-auto max-w-md space-y-4">
          {header}
          {schedulesPlaceholder}
          {role === "student" && (
            <div className="pt-2">
              <LeaveButton courseId={course.id} uid={viewer.uid} />
            </div>
          )}
        </div>
      </main>
    );
  }

  const studentCount = await countStudents(course.id);
  // 서버 렌더 시각 기준으로 만료 여부를 계산한다
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const expired = course.currentInvite?.expiresAt ? new Date(course.currentInvite.expiresAt).getTime() <= now : false;

  return (
    <main className="px-4 py-8">
      <div className="mx-auto max-w-md space-y-4">
        {header}
        <Link
          href={`/courses/${course.id}/members`}
          className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4 transition hover:border-neutral-900"
        >
          <Icon icon="lucide:users" width={20} className="shrink-0" />
          <span className="flex-1 font-semibold">학생 {studentCount}명</span>
          <span className="text-sm text-neutral-500">명단 보기</span>
          <Icon icon="lucide:chevron-right" width={18} className="shrink-0 text-neutral-400" />
        </Link>
        <InviteCard courseId={course.id} invite={course.currentInvite} expired={expired} />
        {schedulesPlaceholder}
        <CourseSettings courseId={course.id} initial={{ title: course.title, term: course.term, description: course.description }} />
      </div>
    </main>
  );
}
