import { notFound } from "next/navigation";
import ScheduleAdmin from "@/components/schedules/ScheduleAdmin";
import StudentSchedulePanel from "@/components/schedules/StudentSchedulePanel";
import { ScheduleDetails, STATUS_BADGE } from "@/components/schedules/ScheduleSummary";
import { BackLink } from "@/components/courses/BackLink";
import { Card } from "@/components/ui";
import { requireViewer } from "@/lib/dal/user";
import { getCourseAccess } from "@/lib/data/courses";
import { getScheduleInCourse, isScheduleVisible } from "@/lib/data/schedules";
import { listBookingsForSchedule, listBookingsForStudent, quotaUsed } from "@/lib/data/bookings";
import { kstToday } from "@/lib/kst";

export const dynamic = "force-dynamic";

export default async function SchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; sid: string }>;
  searchParams: Promise<{ move?: string }>;
}) {
  const { id, sid } = await params;
  const viewer = await requireViewer(`/courses/${id}/schedules/${sid}`);
  const access = await getCourseAccess(id, viewer.uid);
  if (!access) notFound();
  const schedule = await getScheduleInCourse(id, sid);
  if (!schedule || !isScheduleVisible(schedule, viewer.uid, access.role)) notFound();
  const isOwner = access.role === "owner" && viewer.isInstructor;
  // 서버 렌더 시각을 화면의 기준 시각으로 쓴다
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const today = kstToday(now);
  const cfg = { slotMinutes: schedule.slotMinutes, ruleType: schedule.ruleType, recurring: schedule.recurring, manualSlots: schedule.manualSlots };

  const header = (
    <header className="mb-4">
      <BackLink href={`/courses/${id}`} label={access.course.title} />
      <div className="mt-2 flex items-start gap-2">
        <h1 className="min-w-0 flex-1 text-2xl font-bold tracking-tight">{schedule.title}</h1>
        {isOwner && (
          <span className={`mt-1.5 shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[schedule.status].cls}`}>{STATUS_BADGE[schedule.status].label}</span>
        )}
      </div>
      {!isOwner && <p className="mt-1 text-sm text-neutral-500">{access.course.ownerName} 교수</p>}
    </header>
  );

  const details = (
    <Card>
      <ScheduleDetails s={schedule} showAdmin={isOwner} />
      {schedule.description && <p className="mt-3 whitespace-pre-wrap border-t border-neutral-100 pt-3 text-sm text-neutral-700">{schedule.description}</p>}
      {schedule.mode === "online" && schedule.meetingUrl && !isOwner && (
        <p className="mt-3 text-xs text-neutral-500">온라인 상담 링크는 예약 후 내 예약에서 확인할 수 있습니다.</p>
      )}
    </Card>
  );

  if (isOwner) {
    const bookings = await listBookingsForSchedule(schedule.id);
    return (
      <main className="px-4 py-8">
        <div className="mx-auto max-w-2xl space-y-4">
          {header}
          {details}
          <ScheduleAdmin courseId={id} scheduleId={sid} title={schedule.title} status={schedule.status} cfg={cfg} today={today} now={now} bookings={bookings} />
        </div>
      </main>
    );
  }

  const [mine, used] = await Promise.all([listBookingsForStudent(viewer.uid), quotaUsed(schedule.id, viewer.uid)]);
  const myBookings = mine.filter((b) => b.scheduleId === schedule.id);
  return (
    <main className="px-4 py-8">
      <div className="mx-auto max-w-md space-y-4">
        {header}
        {details}
        <StudentSchedulePanel
          courseId={id}
          scheduleId={sid}
          cfg={cfg}
          today={today}
          now={now}
          myBookings={myBookings}
          quota={{ used, max: schedule.maxBookingsPerStudent }}
          cancelCloseHours={schedule.cancelCloseHours}
          initialMoveId={(await searchParams).move ?? null}
        />
      </div>
    </main>
  );
}
