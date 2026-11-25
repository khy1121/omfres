"use client";

import { Icon } from "@iconify/react";
import { useMemo, useState } from "react";
import { btnSecondary } from "@/components/ui";
import { addDays, fmtDateShort, type SlotConfig } from "@/lib/schedule/rules";
import { buildWeek, weekStart, type WeekDay } from "@/lib/schedule/week";

type Props = {
  cfg: SlotConfig;
  scheduleId: string;
  today: string;
  /** 이 일정 예약(예약됨 상태) + 같은 교수의 다른 일정 예약 */
  bookings: Parameters<typeof buildWeek>[0]["bookings"];
};

export default function WeekBoard({ cfg, scheduleId, today, bookings }: Props) {
  const thisWeek = weekStart(today);
  const [start, setStart] = useState(thisWeek);
  const days: WeekDay[] = useMemo(() => buildWeek({ start, cfg, scheduleId, bookings }), [start, cfg, scheduleId, bookings]);
  const total = days.reduce((n, d) => n + d.items.filter((i) => i.kind === "this").length, 0);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" className={`${btnSecondary} min-h-10 px-3 py-1.5`} onClick={() => setStart(addDays(start, -7))} aria-label="이전 주">
          <Icon icon="lucide:chevron-left" width={16} />
        </button>
        <p className="text-sm font-semibold" aria-live="polite">
          {fmtDateShort(start)} ~ {fmtDateShort(addDays(start, 6))} · 이 일정 예약 {total}건
        </p>
        <button type="button" className={`${btnSecondary} min-h-10 px-3 py-1.5`} onClick={() => setStart(addDays(start, 7))} aria-label="다음 주">
          <Icon icon="lucide:chevron-right" width={16} />
        </button>
        {start !== thisWeek && (
          <button type="button" className={`${btnSecondary} min-h-10 px-3 py-1.5`} onClick={() => setStart(thisWeek)}>
            이번 주
          </button>
        )}
      </div>
      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-7">
        {days.map((d) => (
          <li
            key={d.date}
            className={`min-h-24 rounded-lg p-2 ring-1 ${d.date === today ? "bg-white ring-neutral-900" : d.slotCount ? "bg-white ring-neutral-200" : "bg-neutral-50 ring-neutral-200"}`}
          >
            <p className="text-xs font-semibold">{fmtDateShort(d.date)}</p>
            <p className="mb-1.5 text-xs text-neutral-500">{d.slotCount ? `상담 ${d.slotCount}칸` : "상담 없음"}</p>
            <ul className="space-y-1">
              {d.items.map((it) => (
                <li
                  key={it.key}
                  className={`rounded-md px-1.5 py-1 text-xs leading-snug ${it.kind === "this" ? "bg-neutral-900 text-white" : "bg-amber-50 text-amber-950 ring-1 ring-amber-200"}`}
                >
                  <span className="block tabular-nums">{it.time}~{it.endTime}</span>
                  <span className="block break-words font-semibold">{it.title}</span>
                  {it.sub && <span className="block break-words opacity-80">{it.sub}</span>}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <p className="mt-2 flex flex-wrap gap-3 text-xs text-neutral-600">
        <span className="inline-flex items-center gap-1"><span className="inline-block size-3 rounded-sm bg-neutral-900" />이 일정 예약</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block size-3 rounded-sm bg-amber-100 ring-1 ring-amber-300" />다른 수업 상담</span>
      </p>
    </div>
  );
}
