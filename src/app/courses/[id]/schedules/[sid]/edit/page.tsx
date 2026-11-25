import { notFound } from "next/navigation";
import ScheduleForm from "@/components/schedules/ScheduleForm";
import { BackLink } from "@/components/courses/BackLink";
import { requireViewer } from "@/lib/dal/user";
import { getCourseAccess, listMembers } from "@/lib/data/courses";
import { getScheduleInCourse } from "@/lib/data/schedules";
import { draftFromSchedule } from "@/lib/schedule/draft";

export const dynamic = "force-dynamic";

export default async function EditSchedulePage({ params }: { params: Promise<{ id: string; sid: string }> }) {
  const { id, sid } = await params;
  const viewer = await requireViewer(`/courses/${id}/schedules/${sid}/edit`);
  const access = await getCourseAccess(id, viewer.uid);
  if (!access || access.role !== "owner" || !viewer.isInstructor) notFound();
  const schedule = await getScheduleInCourse(id, sid);
  if (!schedule) notFound();
  const students = (await listMembers(id)).filter((m) => m.role === "student").map((m) => ({ uid: m.uid, name: m.name, studentNo: m.studentNo }));

  return (
    <main className="px-4 py-8">
      <div className="mx-auto max-w-xl">
        <header className="mb-6">
          <BackLink href={`/courses/${id}/schedules/${sid}`} label={schedule.title} />
          <h1 className="mt-2 text-2xl font-bold tracking-tight">상담 일정 수정</h1>
          <p className="mt-1 text-sm text-neutral-500">이미 받은 예약의 시각은 바뀌지 않습니다. 영향받는 예약이 있으면 저장 전에 알려드립니다.</p>
        </header>
        <ScheduleForm mode="edit" courseId={id} scheduleId={sid} initial={draftFromSchedule(schedule)} students={students} />
      </div>
    </main>
  );
}
