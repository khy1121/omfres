"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import BookingItem from "./BookingItem";
import { bookingPhase } from "@/lib/schedule/phase";
import BookingPicker from "./BookingPicker";
import { callApi } from "@/components/api";
import { btnDanger, btnPrimary, btnSecondary, Card, ErrorBox, inputCls, successCls } from "@/components/ui";
import { fmtDateKo, type SlotConfig } from "@/lib/schedule/rules";
import { bookingsToCsv, downloadCsv } from "@/lib/booking-csv";
import type { Booking } from "@/lib/data/bookings";
import type { ScheduleStatus } from "@/lib/data/schedules";

type Props = {
  courseId: string;
  scheduleId: string;
  title: string;
  status: ScheduleStatus;
  cfg: SlotConfig;
  today: string;
  now: number;
  bookings: Booking[];
};

type Filter = "upcoming" | "past" | "cancelled" | "all";
const FILTERS: { v: Filter; label: string }[] = [
  { v: "upcoming", label: "예정" },
  { v: "past", label: "지난 상담" },
  { v: "cancelled", label: "취소" },
  { v: "all", label: "전체" },
];

const STATUS_ACTIONS: Record<ScheduleStatus, { to: ScheduleStatus; label: string; primary?: boolean }[]> = {
  draft: [{ to: "open", label: "학생에게 공개", primary: true }],
  open: [{ to: "closed", label: "예약 마감" }, { to: "draft", label: "비공개로 전환" }],
  closed: [{ to: "open", label: "다시 공개", primary: true }],
};

export default function ScheduleAdmin({ courseId, scheduleId, title, status, cfg, today, now, bookings }: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [query, setQuery] = useState("");
  const [moving, setMoving] = useState<Booking | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const base = `/api/courses/${courseId}/schedules/${scheduleId}`;

  const shown = useMemo(() => {
    const q = query.trim();
    return bookings.filter((b) => {
      const phase = bookingPhase(b, now);
      const okFilter =
        filter === "all" ||
        (filter === "cancelled" ? phase === "cancelled" : filter === "upcoming" ? phase === "upcoming" || phase === "ongoing" : phase === "elapsed");
      return okFilter && (!q || b.studentName.includes(q) || (b.studentNo ?? "").includes(q));
    });
  }, [bookings, filter, query, now]);

  const counts = useMemo(() => {
    const c = { upcoming: 0, past: 0, cancelled: 0, all: bookings.length };
    for (const b of bookings) {
      const p = bookingPhase(b, now);
      if (p === "cancelled") c.cancelled++;
      else if (p === "elapsed") c.past++;
      else c.upcoming++;
    }
    return c;
  }, [bookings, now]);

  const grouped = useMemo(() => {
    const m = new Map<string, Booking[]>();
    for (const b of shown) m.set(b.date, [...(m.get(b.date) ?? []), b]);
    return [...m.entries()];
  }, [shown]);

  const changeStatus = async (to: ScheduleStatus) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    const r = await callApi(base, "PATCH", { status: to });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setNotice(to === "open" ? "학생에게 공개했습니다." : to === "closed" ? "예약을 마감했습니다. 기존 예약은 유지됩니다." : "비공개로 전환했습니다. 학생에게 보이지 않습니다.");
    router.refresh();
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    const r = await callApi(base, "DELETE");
    setBusy(false);
    setConfirmDelete(false);
    if (!r.ok) return setError(r.error);
    router.replace(`/courses/${courseId}`);
    router.refresh();
  };

  const exportCsv = () => {
    const label = FILTERS.find((f) => f.v === filter)!.label;
    downloadCsv(`${title}_${label}_${today}.csv`, bookingsToCsv(shown));
  };

  if (moving) {
    return (
      <Card>
        <h2 className="mb-1 text-lg font-bold tracking-tight">예약 시간 옮기기</h2>
        <p className="mb-4 text-sm text-neutral-600">{moving.studentName} ({moving.studentNo}) 학생</p>
        <BookingPicker
          courseId={courseId}
          scheduleId={scheduleId}
          cfg={cfg}
          today={today}
          moving={{ bookingId: moving.id, date: moving.date, time: moving.time }}
          onDone={(b) => {
            setMoving(null);
            setNotice(`${b.studentName} 학생의 예약을 ${fmtDateKo(b.date)} ${b.time}로 옮겼습니다.`);
            router.refresh();
          }}
          onCancel={() => setMoving(null)}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {error && <ErrorBox>{error}</ErrorBox>}
      {notice && (
        <div role="status" className={successCls}>
          <Icon icon="lucide:check-circle" width={18} className="mt-0.5 shrink-0" />
          {notice}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {STATUS_ACTIONS[status].map((a) => (
          <button key={a.to} type="button" onClick={() => changeStatus(a.to)} disabled={busy} className={a.primary ? btnPrimary : btnSecondary}>
            {a.label}
          </button>
        ))}
        <Link href={`/courses/${courseId}/schedules/${scheduleId}/edit`} className={btnSecondary}>
          <Icon icon="lucide:pencil" width={16} />
          수정
        </Link>
        {!confirmDelete && (
          <button type="button" onClick={() => setConfirmDelete(true)} disabled={busy} className={`${btnSecondary} text-red-800`}>삭제</button>
        )}
      </div>
      {confirmDelete && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <p className="mb-2">이 일정을 삭제할까요? 예정된 예약이 있으면 삭제할 수 없습니다. 지난 예약 기록은 내 예약 목록에 남습니다.</p>
          <div className="flex gap-2">
            <button type="button" onClick={remove} disabled={busy} className={btnDanger}>삭제</button>
            <button type="button" onClick={() => setConfirmDelete(false)} disabled={busy} className={btnSecondary}>취소</button>
          </div>
        </div>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-lg font-bold tracking-tight">예약 현황</h2>
          <button type="button" onClick={exportCsv} disabled={!shown.length} className={`${btnSecondary} min-h-10 px-3 py-1.5`}>
            <Icon icon="lucide:download" width={16} />
            CSV ({shown.length}건)
          </button>
        </div>
        <div className="mb-3 flex flex-wrap gap-1" role="group" aria-label="예약 상태 필터">
          {FILTERS.map((f) => (
            <button
              key={f.v}
              type="button"
              aria-pressed={filter === f.v}
              onClick={() => setFilter(f.v)}
              className={`min-h-10 rounded-lg px-3 text-sm transition ${filter === f.v ? "bg-neutral-900 font-semibold text-white" : "bg-white text-neutral-700 ring-1 ring-neutral-200 hover:ring-neutral-900"}`}
            >
              {f.label} {counts[f.v]}
            </button>
          ))}
        </div>
        <input className={`${inputCls} mb-3`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="이름 또는 학번 검색" aria-label="예약 검색" />
        {grouped.length === 0 ? (
          <p className="rounded-lg bg-white p-4 text-sm text-neutral-600 ring-1 ring-neutral-200">
            {bookings.length === 0 ? (status === "open" ? "아직 예약한 학생이 없습니다." : "학생에게 공개하면 예약을 받을 수 있습니다.") : "조건에 맞는 예약이 없습니다."}
          </p>
        ) : (
          <div className="space-y-4">
            {grouped.map(([date, list]) => (
              <div key={date}>
                <h3 className="mb-2 text-sm font-semibold text-neutral-600">{fmtDateKo(date)} · {list.length}건</h3>
                <ul className="space-y-2">
                  {list.map((b) => (
                    <BookingItem
                      key={b.id}
                      booking={b}
                      now={now}
                      viewAs="instructor"
                      onMove={() => setMoving(b)}
                      onCancelled={() => setNotice(`${b.studentName} 학생의 ${fmtDateKo(b.date)} ${b.time} 예약을 취소했습니다.`)}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
