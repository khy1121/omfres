"use client";

import { useEffect, useState } from "react";
import { ErrorBox, inputCls } from "@/components/ui";
import { fmtDateKo } from "@/lib/schedule/rules";
import type { DateDiagnosis, SlotDiagnosis } from "@/lib/schedule/diagnose";

// 교수용: 날짜를 고르면 그날 시간마다 예약 가능 여부와 막힌 이유를 보여준다

const STATUS: Record<SlotDiagnosis["status"], { label: string; cls: string }> = {
  open: { label: "예약 가능", cls: "bg-emerald-50 text-emerald-900 ring-emerald-200" },
  booked: { label: "예약됨", cls: "bg-neutral-900 text-white ring-neutral-900" },
  conflict: { label: "다른 상담과 겹침", cls: "bg-amber-50 text-amber-900 ring-amber-200" },
  buffer: { label: "상담 후 여유 시간", cls: "bg-amber-50 text-amber-900 ring-amber-200" },
  dayFull: { label: "하루 최대 도달", cls: "bg-red-50 text-red-900 ring-red-200" },
  past: { label: "지난 시간", cls: "bg-neutral-100 text-neutral-600 ring-neutral-200" },
};

const SOURCE: Record<NonNullable<DateDiagnosis["source"]>, string> = {
  weekly: "요일별 시간",
  override: "날짜별 시간 변경",
  manual: "직접 지정한 시간",
};

export default function DateDiagnosisPanel({ courseId, scheduleId, today }: { courseId: string; scheduleId: string; today: string }) {
  const [date, setDate] = useState(today);
  const [data, setData] = useState<DateDiagnosis | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    let alive = true;
    fetch(`/api/courses/${courseId}/schedules/${scheduleId}/diagnose?date=${date}`)
      .then(async (r) => {
        const j = await r.json();
        if (!alive) return;
        if (!r.ok) {
          setData(null);
          setError(j.error ?? "확인하지 못했습니다.");
        } else {
          setError(null);
          setData(j);
        }
      })
      .catch(() => alive && setError("네트워크 오류로 확인하지 못했습니다."));
    return () => {
      alive = false;
    };
  }, [courseId, scheduleId, date]);

  const open = data?.slots.filter((s) => s.status === "open").length ?? 0;

  return (
    <section>
      <h2 className="mb-1 text-lg font-bold tracking-tight">날짜별 확인</h2>
      <p className="mb-3 text-sm text-neutral-600">학생 화면에서 상담이 안 보이는 날이 있으면 날짜를 골라 이유를 확인하세요.</p>
      <label className="mb-3 block max-w-xs text-sm font-medium">
        날짜
        <input type="date" className={`${inputCls} mt-1`} value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      {error && <ErrorBox>{error}</ErrorBox>}
      {data && data.date === date && (
        <div className="rounded-lg bg-white p-4 ring-1 ring-neutral-200" aria-live="polite">
          <p className="mb-2 font-semibold">
            {fmtDateKo(date)}
            {data.dayReason ? ` · ${data.dayReason}` : ` · 예약 가능 ${open}개 / 전체 ${data.slots.length}개`}
          </p>
          {data.source && (
            <p className="mb-3 text-sm text-neutral-600">
              적용된 시간: {SOURCE[data.source]}
              {data.windows.length > 0 && ` (${data.windows.map((w) => `${w.start}~${w.end}`).join(", ")})`}
            </p>
          )}
          {data.slots.length > 0 && (
            <ul className="space-y-1.5">
              {data.slots.map((s) => (
                <li key={s.time} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="w-24 tabular-nums">{s.time}~{s.end}</span>
                  <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ${STATUS[s.status].cls}`}>{STATUS[s.status].label}</span>
                  {s.detail && <span className="text-neutral-600">{s.detail}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
