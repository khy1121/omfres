import { notFound } from "next/navigation";
import ScheduleForm from "@/components/schedules/ScheduleForm";
import { BackLink } from "@/components/courses/BackLink";
import { btnSecondary, inputCls } from "@/components/styles";
import { requireViewer } from "@/lib/dal/user";
import { getCourseAccess, listMembers, listMyCourses } from "@/lib/data/courses";
import { listSchedules, listSchedulesByInstructor } from "@/lib/data/schedules";
import { copyDraft, emptyDraft } from "@/lib/schedule/draft";
import { kstToday } from "@/lib/kst";

export const dynamic = "force-dynamic";

export default async function NewSchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ copy?: string }>;
}) {
  const { id } = await params;
  const { copy } = await searchParams;
  const viewer = await requireViewer(`/courses/${id}/schedules/new`);
  const access = await getCourseAccess(id, viewer.uid);
  if (!access || access.role !== "owner" || !viewer.isInstructor) notFound();

  const [members, existing, mine, courses] = await Promise.all([
    listMembers(id),
    listSchedules(id),
    listSchedulesByInstructor(viewer.uid),
    listMyCourses(viewer.uid),
  ]);
  const students = members.filter((m) => m.role === "student").map((m) => ({ uid: m.uid, name: m.name, studentNo: m.studentNo }));
  // 복제 목록: 지금도 내가 개설자인 그룹의 일정만
  const owned = new Map(courses.filter((c) => c.role === "owner").map((c) => [c.id, c.title]));
  const copyable = mine.filter((s) => owned.has(s.courseId));
  const today = kstToday();

  const source = copy ? copyable.find((s) => s.id === copy) : undefined;
  const copied = source
    ? copyDraft(source, { today, sameCourse: source.courseId === id, memberIds: students.map((s) => s.uid) })
    : null;
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

        {copyable.length > 0 && (
          <form method="get" className="mb-6 rounded-lg bg-white p-4 ring-1 ring-neutral-200">
            <label htmlFor="copy" className="mb-1 block text-sm font-semibold">기존 일정 불러오기</label>
            <p className="mb-2 text-xs text-neutral-600">지난 학기나 다른 분반 일정을 복제해 고칠 수 있습니다. 예약은 복제되지 않습니다.</p>
            <div className="flex gap-2">
              <select id="copy" name="copy" defaultValue={source?.id ?? ""} className={`${inputCls} min-w-0 flex-1`}>
                <option value="" disabled>일정 선택</option>
                {copyable.map((s) => (
                  <option key={s.id} value={s.id}>
                    {owned.get(s.courseId)} · {s.title}
                  </option>
                ))}
              </select>
              <button type="submit" className={btnSecondary}>불러오기</button>
            </div>
          </form>
        )}

        {copied && (
          <div role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            <p className="font-semibold">&lsquo;{source!.title}&rsquo; 일정을 불러왔습니다. 저장하기 전에 내용을 확인하세요.</p>
            <ul className="mt-1 list-disc pl-5">
              {copied.shiftedWeeks > 0 && <li>지난 기간이라 날짜를 {copied.shiftedWeeks}주 뒤로 옮겼습니다. 요일은 그대로입니다.</li>}
              {source!.courseId !== id && <li>다른 그룹의 일정이라 대상 학생은 &lsquo;전체&rsquo;로 바꿨습니다.</li>}
            </ul>
          </div>
        )}

        <ScheduleForm
          key={source?.id ?? "empty"}
          mode="create"
          courseId={id}
          initial={copied?.draft ?? emptyDraft(today, lastLocation)}
          students={students}
        />
      </div>
    </main>
  );
}
