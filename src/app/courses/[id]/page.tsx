import { Icon } from "@iconify/react";
import Link from "next/link";
import { notFound } from "next/navigation";
import CourseSettings from "@/components/courses/CourseSettings";
import InviteCard from "@/components/courses/InviteCard";
import LeaveButton from "@/components/courses/LeaveButton";
import { BackLink } from "@/components/courses/BackLink";
import BookingItem from "@/components/schedules/BookingItem";
import { ScheduleCard } from "@/components/schedules/ScheduleSummary";
import { btnPrimary } from "@/components/styles";
import { Card } from "@/components/ui";
import { requireViewer } from "@/lib/dal/user";
import { countStudents, getCourseAccess } from "@/lib/data/courses";
import { isScheduleVisible, listSchedules } from "@/lib/data/schedules";
import { listBookingsForCourse, listBookingsForStudent } from "@/lib/data/bookings";
import { kstInstant } from "@/lib/schedule/rules";

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

  // 서버 렌더 시각 기준으로 예약 상태와 만료 여부를 계산한다
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const schedules = (await listSchedules(course.id)).filter((s) => isScheduleVisible(s, viewer.uid, isOwner ? "owner" : "student"));

  if (!isOwner) {
    const mine = (await listBookingsForStudent(viewer.uid)).filter((b) => b.courseId === course.id);
    const upcoming = mine.filter((b) => b.status === "booked" && kstInstant(b.date, b.time) + b.slotMinutes * 60_000 > now);
    const countBy = new Map<string, number>();
    for (const b of mine) if (b.status === "booked") countBy.set(b.scheduleId, (countBy.get(b.scheduleId) ?? 0) + 1);
    return (
      <main className="px-4 py-8">
        <div className="mx-auto max-w-md space-y-4">
          {header}
          {upcoming.length > 0 && (
            <section>
              <h2 className="mb-2 font-bold tracking-tight">다가오는 내 상담</h2>
              <ul className="space-y-2">
                {upcoming.map((b) => (
                  <BookingItem key={b.id} booking={b} now={now} viewAs="student" moveHref={`/courses/${course.id}/schedules/${b.scheduleId}?move=${b.id}`} cancelCloseHours={schedules.find((s) => s.id === b.scheduleId)?.cancelCloseHours ?? 0} />
                ))}
              </ul>
            </section>
          )}
          <section>
            <h2 className="mb-2 flex items-center gap-2 font-bold tracking-tight">
              <Icon icon="lucide:calendar-days" width={18} />
              상담 일정
            </h2>
            {schedules.length ? (
              <ul className="space-y-2">
                {schedules.map((s) => (
                  <ScheduleCard
                    key={s.id}
                    s={s}
                    href={`/courses/${course.id}/schedules/${s.id}`}
                    footer={
                      countBy.get(s.id) ? (
                        <span className="font-medium">내 예약 {countBy.get(s.id)}건 · 최대 {s.maxBookingsPerStudent}회</span>
                      ) : (
                        <span className="font-medium text-neutral-900">예약하기 →</span>
                      )
                    }
                  />
                ))}
              </ul>
            ) : (
              <Card>
                <p className="text-sm text-neutral-500">아직 열린 상담 일정이 없습니다. 교수님이 일정을 열면 여기에 표시됩니다.</p>
              </Card>
            )}
          </section>
          {role === "student" && (
            <div className="pt-2">
              <LeaveButton courseId={course.id} uid={viewer.uid} />
            </div>
          )}
        </div>
      </main>
    );
  }

  const [studentCount, courseBookings] = await Promise.all([countStudents(course.id), listBookingsForCourse(course.id)]);
  const upcomingBy = new Map<string, number>();
  for (const b of courseBookings) {
    if (b.status === "booked" && kstInstant(b.date, b.time) > now) upcomingBy.set(b.scheduleId, (upcomingBy.get(b.scheduleId) ?? 0) + 1);
  }
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
        <section>
          <div className="mb-2 flex items-center gap-2">
            <h2 className="mr-auto flex items-center gap-2 text-lg font-bold tracking-tight">
              <Icon icon="lucide:calendar-days" width={18} />
              상담 일정
            </h2>
            <Link href={`/courses/${course.id}/schedules/new`} className={`${btnPrimary} min-h-10 px-3 py-1.5`}>
              <Icon icon="lucide:plus" width={16} />
              새 일정
            </Link>
          </div>
          {schedules.length ? (
            <ul className="space-y-2">
              {schedules.map((s) => (
                <ScheduleCard
                  key={s.id}
                  s={s}
                  showStatus
                  href={`/courses/${course.id}/schedules/${s.id}`}
                  footer={<span className="font-medium">예정 예약 {upcomingBy.get(s.id) ?? 0}건</span>}
                />
              ))}
            </ul>
          ) : (
            <Card>
              <p className="text-sm text-neutral-500">아직 만든 상담 일정이 없습니다. 상담 가능한 기간과 시간대를 정해 일정을 열어보세요.</p>
            </Card>
          )}
        </section>
        <InviteCard courseId={course.id} invite={course.currentInvite} expired={expired} />
        <CourseSettings courseId={course.id} initial={{ title: course.title, term: course.term, description: course.description }} />
      </div>
    </main>
  );
}
