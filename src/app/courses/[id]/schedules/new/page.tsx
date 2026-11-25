import { notFound } from "next/navigation";
import ScheduleForm from "@/components/schedules/ScheduleForm";
import { BackLink } from "@/components/courses/BackLink";
import { requireViewer } from "@/lib/dal/user";
import { getCourseAccess, listMembers } from "@/lib/data/courses";
import { listSchedules } from "@/lib/data/schedules";
import { emptyDraft } from "@/lib/schedule/draft";
import { kstToday } from "@/lib/kst";

export const dynamic = "force-dynamic";

export default async function NewSchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireViewer(`/courses/${id}/schedules/new`);
  const access = await getCourseAccess(id, viewer.uid);
  if (!access || access.role !== "owner" || !viewer.isInstructor) notFound();

  const [members, existing] = await Promise.all([listMembers(id), listSchedules(id)]);
  const students = members.filter((m) => m.role === "student").map((m) => ({ uid: m.uid, name: m.name, studentNo: m.studentNo }));
  // 이전 일정의 장소를 기본값으로 (교수 연구실 등)
  const lastLocation = [...existing].reverse().find((s) => s.mode === "offline")?.location ?? "";

  return (
    <main className="px-4 py-8">
      <div className="mx-auto max-w-xl">
        <header className="mb-6">
          <BackLink href={`/courses/${id}`} label={access.course.title} />
          <h1 className="mt-2 text-2xl font-bold tracking-tight">새 상담 일정</h1>
          <p className="mt-1 text-sm text-neutral-500">가능한 시간을 열어두면 학생이 직접 골라 예약합니다.</p>
        </header>
        <ScheduleForm mode="create" courseId={id} initial={emptyDraft(kstToday(), lastLocation)} students={students} />
      </div>
    </main>
  );
}
