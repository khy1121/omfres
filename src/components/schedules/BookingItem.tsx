"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { callApi } from "@/components/api";
import { btnDanger, btnSecondary, ErrorBox } from "@/components/ui";
import { fmtDateKo, isPastDeadline, kstInstant } from "@/lib/schedule/rules";
import type { Booking } from "@/lib/data/bookings";
import { bookingPhase, type BookingPhase } from "@/lib/schedule/phase";

const PHASE: Record<BookingPhase, { label: string; cls: string }> = {
  upcoming: { label: "예정", cls: "bg-neutral-900 text-white" },
  ongoing: { label: "상담 시간 중", cls: "bg-emerald-700 text-white" },
  elapsed: { label: "상담 시간 경과", cls: "bg-neutral-200 text-neutral-700" },
  cancelled: { label: "취소됨", cls: "bg-red-50 text-red-800 border border-red-200" },
};

type Props = {
  booking: Booking;
  now: number;
  /** 학생: 내 예약 / 교수자: 학생 예약 관리 */
  viewAs: "student" | "instructor";
  /** 학생 변경·취소 마감 (시간). 알 수 없으면 0 */
  cancelCloseHours?: number;
  /** 시간 변경 링크 또는 동작 */
  moveHref?: string;
  onMove?: () => void;
  /** 수업·일정 이름 표시 (여러 수업을 모아 보여줄 때) */
  showContext?: boolean;
  /** 취소 성공 후 호출 (상위 화면의 안내 갱신용) */
  onCancelled?: () => void;
};

export default function BookingItem({ booking: b, now, viewAs, cancelCloseHours = 0, moveHref, onMove, showContext, onCancelled }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const phase = bookingPhase(b, now);
  const start = kstInstant(b.date, b.time);
  const canChange =
    b.status === "booked" && (viewAs === "instructor" ? now < start : !isPastDeadline(start, cancelCloseHours, now));
  const canCancel = b.status === "booked" && (viewAs === "instructor" || canChange);

  const cancel = async () => {
    setBusy(true);
    setError(null);
    const r = await callApi(`/api/bookings/${b.id}`, "DELETE");
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setConfirming(false);
    onCancelled?.();
    router.refresh();
  };

  return (
    <li className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1">
          <div className="text-sm text-neutral-600">{fmtDateKo(b.date)}</div>
          <div className="text-lg font-bold tabular-nums">
            {b.time} ~ {b.endTime}
          </div>
        </div>
        <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${PHASE[phase].cls}`}>{PHASE[phase].label}</span>
      </div>

      <div className="mt-2 space-y-1 text-sm text-neutral-700">
        {viewAs === "instructor" ? (
          <div className="flex flex-wrap gap-x-2">
            <span className="font-semibold">{b.studentName}</span>
            <span className="tabular-nums text-neutral-500">{b.studentNo}</span>
            <span className="break-all text-neutral-500">{b.studentEmail}</span>
          </div>
        ) : null}
        {showContext && (
          <div>
            {b.courseTitle} · {b.scheduleTitle}
            {viewAs === "student" && b.instructorName ? ` · ${b.instructorName} 교수` : ""}
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Icon icon={b.mode === "online" ? "lucide:video" : "lucide:map-pin"} width={15} className="shrink-0 text-neutral-500" />
          {b.mode === "online" ? (
            b.meetingUrl ? (
              <a href={b.meetingUrl} target="_blank" rel="noreferrer" className="break-all underline underline-offset-2">
                온라인 상담 링크
              </a>
            ) : (
              <span>온라인{b.location ? ` · ${b.location}` : ""}</span>
            )
          ) : (
            <span>{b.location}</span>
          )}
        </div>
        {b.status === "cancelled" && (
          <div className="text-xs text-red-800">{b.cancelledBy === "instructor" ? "교수님이 취소했습니다." : "학생이 취소했습니다."}</div>
        )}
      </div>

      {error && <div className="mt-3"><ErrorBox>{error}</ErrorBox></div>}

      {(canChange || canCancel) && !confirming && (
        <div className="mt-3 flex flex-wrap gap-2">
          {canChange && moveHref && (
            <Link href={moveHref} className={`${btnSecondary} min-h-10 px-3 py-1.5`}>시간 변경</Link>
          )}
          {canChange && onMove && (
            <button type="button" onClick={onMove} className={`${btnSecondary} min-h-10 px-3 py-1.5`}>시간 변경</button>
          )}
          {canCancel && (
            <button type="button" onClick={() => setConfirming(true)} className={`${btnSecondary} min-h-10 px-3 py-1.5 text-red-800`}>
              {viewAs === "instructor" ? "예약 취소" : "취소"}
            </button>
          )}
        </div>
      )}
      {b.status === "booked" && viewAs === "student" && !canChange && phase === "upcoming" && (
        <p className="mt-3 text-xs text-neutral-500">변경·취소 가능 시간이 지났습니다. 필요하면 교수님께 직접 문의해주세요.</p>
      )}
      {confirming && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <p className="mb-2">{viewAs === "instructor" ? `${b.studentName} 학생의 예약을 취소할까요?` : "이 예약을 취소할까요?"} 취소한 시간은 다른 학생이 예약할 수 있게 됩니다.</p>
          <div className="flex gap-2">
            <button type="button" onClick={cancel} disabled={busy} className={btnDanger}>{busy ? "취소하는 중…" : "예약 취소"}</button>
            <button type="button" onClick={() => setConfirming(false)} disabled={busy} className={btnSecondary}>돌아가기</button>
          </div>
        </div>
      )}
    </li>
  );
}
