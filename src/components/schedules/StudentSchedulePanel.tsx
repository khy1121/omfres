"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import BookingPicker from "./BookingPicker";
import BookingItem from "./BookingItem";
import AddToCalendarButton from "./AddToCalendarButton";
import NoFitHelp, { type NoFitHelpProps } from "./NoFitHelp";
import { btnPrimary, btnSecondary, Card, successCls } from "@/components/ui";
import { fmtDateKo, type SlotConfig } from "@/lib/schedule/rules";
import type { Booking } from "@/lib/data/bookings";

type Props = {
  courseId: string;
  scheduleId: string;
  cfg: SlotConfig;
  today: string;
  now: number;
  myBookings: Booking[];
  quota: { used: number; max: number };
  cancelCloseHours: number;
  /** 주소의 ?move=예약ID 로 들어오면 그 예약의 시간 변경부터 시작 */
  initialMoveId: string | null;
  /** 맞는 시간이 없을 때 안내 (교수 메일·다른 일정) */
  help: NoFitHelpProps;
};

export default function StudentSchedulePanel({ courseId, scheduleId, cfg, today, now, myBookings, quota, cancelCloseHours, initialMoveId, help }: Props) {
  const router = useRouter();
  const active = myBookings.filter((b) => b.status === "booked");
  const [moveId, setMoveId] = useState<string | null>(active.some((b) => b.id === initialMoveId) ? initialMoveId : null);
  const [done, setDone] = useState<{ booking: Booking; moved: boolean } | null>(null);
  const [booking, setBooking] = useState(false);
  const moving = moveId ? active.find((b) => b.id === moveId) ?? null : null;
  const canBookMore = quota.used < quota.max;

  if (done) {
    const b = done.booking;
    return (
      <Card>
        <div role="status" className={successCls}>
          <Icon icon="lucide:check-circle" width={18} className="mt-0.5 shrink-0" />
          {done.moved ? "예약 시간을 변경했습니다." : "예약했습니다."}
        </div>
        <div className="mb-5 rounded-lg bg-neutral-100 p-4">
          <div className="text-sm">{fmtDateKo(b.date)}</div>
          <div className="text-2xl font-bold tabular-nums">{b.time} ~ {b.endTime}</div>
          <div className="mt-2 text-sm text-neutral-600">
            {b.scheduleTitle} · {b.mode === "online" ? "온라인" : b.location}
          </div>
        </div>
        <AddToCalendarButton booking={b} className={`${btnSecondary} w-full border-[1.5px] border-neutral-900 font-bold`} />
        <p className="mb-5 mt-2 text-xs text-neutral-600">
          휴대폰·Google·Outlook 캘린더에 일정을 넣습니다. 지원하는 캘린더 앱에서는 하루 전 알림도 함께 설정됩니다.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Link href="/bookings" className={`${btnPrimary} sm:flex-1`}>내 예약 보기</Link>
          <button type="button" onClick={() => { setDone(null); setBooking(false); setMoveId(null); router.refresh(); }} className={btnSecondary}>
            이 일정으로 돌아가기
          </button>
        </div>
      </Card>
    );
  }

  if (moving) {
    return (
      <Card>
        <h2 className="mb-4 text-lg font-bold tracking-tight">예약 시간 변경</h2>
        <BookingPicker
          courseId={courseId}
          scheduleId={scheduleId}
          cfg={cfg}
          today={today}
          moving={{ bookingId: moving.id, date: moving.date, time: moving.time }}
          onDone={(b) => setDone({ booking: b, moved: true })}
          onCancel={() => setMoveId(null)}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {myBookings.length > 0 && (
        <section>
          <h2 className="mb-2 font-bold tracking-tight">이 일정의 내 예약</h2>
          <ul className="space-y-2">
            {myBookings.map((b) => (
              <BookingItem key={b.id} booking={b} now={now} viewAs="student" cancelCloseHours={cancelCloseHours} onMove={() => setMoveId(b.id)} />
            ))}
          </ul>
        </section>
      )}
      <Card>
        {canBookMore ? (
          booking || active.length === 0 ? (
            <>
              <h2 className="mb-4 text-lg font-bold tracking-tight">날짜와 시간 선택</h2>
              <BookingPicker courseId={courseId} scheduleId={scheduleId} cfg={cfg} today={today} onDone={(b) => setDone({ booking: b, moved: false })} />
            </>
          ) : (
            <div>
              <p className="mb-3 text-sm text-neutral-600">이 일정은 {quota.max}회까지 예약할 수 있습니다. ({quota.used}회 사용)</p>
              <button type="button" onClick={() => setBooking(true)} className={`${btnPrimary} w-full`}>추가로 예약하기</button>
            </div>
          )
        ) : (
          <p className="text-sm text-neutral-600">
            이 일정의 예약 가능 횟수({quota.max}회)를 모두 사용했습니다. 다른 시간이 필요하면 기존 예약의 시간을 변경해주세요.
          </p>
        )}
      </Card>
      <NoFitHelp {...help} />
    </div>
  );
}
