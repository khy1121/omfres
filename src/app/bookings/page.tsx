import Link from "next/link";
import BookingItem from "@/components/schedules/BookingItem";
import { bookingPhase } from "@/lib/schedule/phase";
import { btnPrimary } from "@/components/styles";
import { Card } from "@/components/ui";
import { requireViewer } from "@/lib/dal/user";
import { listBookingsForInstructor, listBookingsForStudent, type Booking } from "@/lib/data/bookings";
import { getSchedulesByIds } from "@/lib/data/schedules";
import { fmtDateKo } from "@/lib/schedule/rules";

export const dynamic = "force-dynamic";

function Group({ title, children, empty }: { title: string; children: React.ReactNode; empty?: string }) {
  return (
    <section>
      <h2 className="mb-2 font-bold tracking-tight">{title}</h2>
      {children ?? <p className="text-sm text-neutral-500">{empty}</p>}
    </section>
  );
}

export default async function BookingsPage() {
  const viewer = await requireViewer("/bookings");
  // 서버 렌더 시각 기준
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  if (!viewer.profileComplete) {
    return (
      <main className="px-4 py-8">
        <div className="mx-auto max-w-md">
          <h1 className="mb-6 text-2xl font-bold tracking-tight">내 예약</h1>
          <Card>
            <p className="mb-4 text-sm text-neutral-600">먼저 내 정보를 입력해주세요.</p>
            <Link href="/me?next=/bookings" className={`${btnPrimary} w-full`}>내 정보 입력하기</Link>
          </Card>
        </div>
      </main>
    );
  }

  if (viewer.isInstructor) {
    const all = await listBookingsForInstructor(viewer.uid);
    const upcoming = all.filter((b) => bookingPhase(b, now) !== "elapsed");
    const byDate = new Map<string, Booking[]>();
    for (const b of upcoming) byDate.set(b.date, [...(byDate.get(b.date) ?? []), b]);
    return (
      <main className="px-4 py-8">
        <div className="mx-auto max-w-2xl space-y-5">
          <header>
            <h1 className="text-2xl font-bold tracking-tight">다가오는 상담</h1>
            <p className="mt-1 text-sm text-neutral-500">모든 수업의 예정된 상담입니다. 시간 변경은 각 일정 화면에서 할 수 있습니다.</p>
          </header>
          {byDate.size === 0 ? (
            <Card><p className="text-sm text-neutral-600">예정된 상담이 없습니다.</p></Card>
          ) : (
            [...byDate.entries()].map(([date, list]) => (
              <Group key={date} title={`${fmtDateKo(date)} · ${list.length}건`}>
                <ul className="space-y-2">
                  {list.map((b) => (
                    <BookingItem key={b.id} booking={b} now={now} viewAs="instructor" showContext moveHref={`/courses/${b.courseId}/schedules/${b.scheduleId}`} />
                  ))}
                </ul>
              </Group>
            ))
          )}
        </div>
      </main>
    );
  }

  const all = await listBookingsForStudent(viewer.uid);
  const schedules = await getSchedulesByIds(all.map((b) => b.scheduleId));
  const upcoming = all.filter((b) => ["upcoming", "ongoing"].includes(bookingPhase(b, now)));
  const past = all.filter((b) => bookingPhase(b, now) === "elapsed").reverse();
  const cancelled = all.filter((b) => b.status === "cancelled").reverse();
  const item = (b: Booking) => (
    <BookingItem
      key={b.id}
      booking={b}
      now={now}
      viewAs="student"
      showContext
      cancelCloseHours={schedules.get(b.scheduleId)?.cancelCloseHours ?? 0}
      moveHref={schedules.has(b.scheduleId) ? `/courses/${b.courseId}/schedules/${b.scheduleId}?move=${b.id}` : undefined}
    />
  );

  return (
    <main className="px-4 py-8">
      <div className="mx-auto max-w-md space-y-5">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">내 예약</h1>
          <p className="mt-1 text-sm text-neutral-500">모든 수업의 상담 예약입니다.</p>
        </header>
        {all.length === 0 ? (
          <Card>
            <p className="mb-4 text-sm text-neutral-600">아직 예약한 상담이 없습니다.</p>
            <Link href="/courses" className={`${btnPrimary} w-full`}>내 수업에서 예약하기</Link>
          </Card>
        ) : (
          <>
            <Group title={`예정 ${upcoming.length}건`} empty="예정된 상담이 없습니다.">
              {upcoming.length ? <ul className="space-y-2">{upcoming.map(item)}</ul> : null}
            </Group>
            {past.length > 0 && (
              <Group title={`지난 상담 ${past.length}건`}>
                <ul className="space-y-2">{past.map(item)}</ul>
              </Group>
            )}
            {cancelled.length > 0 && (
              <Group title={`취소 ${cancelled.length}건`}>
                <ul className="space-y-2">{cancelled.map(item)}</ul>
              </Group>
            )}
          </>
        )}
      </div>
    </main>
  );
}
