"use client";

import { Icon } from "@iconify/react";
import { useLayoutEffect, useRef, useState } from "react";
import { lastBookableDate } from "@/lib/config";
import { WEEKDAYS } from "@/lib/format";

type Props = {
  selected: string | null;
  onSelect: (date: string) => void;
  isSelectable: (date: string) => boolean;
  unavailableReason?: (date: string) => string | null;
  today: string;
};

function ymd(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export default function Calendar({ selected, onSelect, isSelectable, unavailableReason, today }: Props) {
  const max = lastBookableDate(today);
  const [focusDate, setFocusDate] = useState(selected ?? today);
  const focusRequested = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const [ty, tm] = today.split("-").map(Number);
  const [iy, im] = (selected ?? today).split("-").map(Number);
  const [view, setView] = useState({ y: iy, m: im - 1 });
  useLayoutEffect(() => {
    if (focusRequested.current) {
      root.current?.querySelector<HTMLButtonElement>(`[data-date="${focusDate}"]`)?.focus();
      focusRequested.current = false;
    }
  }, [focusDate, view]);

  const first = new Date(Date.UTC(view.y, view.m, 1));
  const startPad = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [
    ...Array(startPad).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7) cells.push(null);

  const move = (delta: number) => {
    const d = new Date(Date.UTC(view.y, view.m + delta, 1));
    setView({ y: d.getUTCFullYear(), m: d.getUTCMonth() });
    const start = ymd(d.getUTCFullYear(), d.getUTCMonth(), 1);
    setFocusDate(start < today ? today : start);
  };
  const isCurrentOrPastMonth = view.y < ty || (view.y === ty && view.m <= tm - 1);

  const navBtn = "rounded-lg p-1.5 transition hover:bg-neutral-100 disabled:opacity-25 disabled:hover:bg-transparent";

  return (
    <div ref={root} className="select-none">
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => move(-1)} disabled={isCurrentOrPastMonth} className={navBtn} aria-label="이전 달">
          <Icon icon="lucide:chevron-left" width={20} />
        </button>
        <div aria-live="polite" className="font-semibold tracking-tight">
          {view.y}년 {view.m + 1}월
        </div>
        <button type="button" onClick={() => move(1)} disabled={ymd(view.y, view.m, 1).slice(0, 7) >= max.slice(0, 7)} className={navBtn} aria-label="다음 달">
          <Icon icon="lucide:chevron-right" width={20} />
        </button>
      </div>
      <p className="mb-2 text-xs text-neutral-500">방향키로 날짜 이동 · Enter로 선택</p>
      <div aria-hidden="true" className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-neutral-500">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const date = ymd(view.y, view.m, d);
          const ok = isSelectable(date);
          const isSel = selected === date;
          const isToday = date === today;
          const reason = ok ? null : unavailableReason?.(date) ?? "예약 불가";
          return (
            <button
              key={date}
              type="button"
              data-date={date}
              tabIndex={focusDate === date ? 0 : -1}
              aria-disabled={!ok}
              aria-pressed={isSel}
              aria-current={isToday ? "date" : undefined}
              aria-label={`${view.y}년 ${view.m + 1}월 ${d}일 ${WEEKDAYS[new Date(date).getUTCDay()]}요일${isToday ? ", 오늘" : ""}, ${reason ?? "선택 가능"}`}
              title={reason ?? "선택 가능"}
              onFocus={() => setFocusDate(date)}
              onClick={() => { if (ok) onSelect(date); }}
              onKeyDown={(event) => {
                const dow = new Date(date).getUTCDay();
                const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -dow, End: 6 - dow };
                if (!(event.key in offsets)) return;
                event.preventDefault();
                const next = new Date(`${date}T00:00:00Z`);
                next.setUTCDate(next.getUTCDate() + offsets[event.key]);
                const value = next.toISOString().slice(0, 10);
                if (value < today || value > max) return;
                focusRequested.current = true;
                setFocusDate(value);
                setView({ y: next.getUTCFullYear(), m: next.getUTCMonth() });
              }}
              className={[
                "min-h-12 rounded-lg px-0.5 py-2 text-sm transition",
                isSel
                  ? "bg-neutral-900 font-semibold text-white"
                  : ok
                    ? "text-neutral-900 hover:bg-neutral-100"
                    : "cursor-not-allowed bg-neutral-50 text-neutral-500",
                isToday && !isSel ? "ring-1 ring-neutral-900" : "",
              ].join(" ")}
            >
              {d}
              {reason && <span className="mt-0.5 block text-[10px] leading-tight">{reason}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
