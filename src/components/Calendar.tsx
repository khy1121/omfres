"use client";

import { Icon } from "@iconify/react";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { WEEKDAY_NAMES as WEEKDAYS } from "@/lib/schedule/rules";

type Props = {
  selected: string | null;
  onSelect: (date: string) => void;
  isSelectable: (date: string) => boolean;
  unavailableReason?: (date: string) => string | null;
  today: string;
  /** 탐색 가능한 마지막 날짜 */
  max: string;
  /** 선택 전 처음 보여줄 날짜 (예: 첫 상담일) */
  start?: string;
  /** 선택 가능한 날짜 아래에 보여줄 짧은 안내. text: 화면 표시(예: "3개"), label: 화면 낭독용 */
  note?: (date: string) => { text: string; label: string } | null;
};

function ymd(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** 키보드 이동 목표 날짜 (APG 날짜 선택 기준). 해당 키가 아니면 null */
export function keyTarget(date: string, key: string, shift: boolean): string | null {
  const [y, m, d] = date.split("-").map(Number);
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  const days: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -dow, End: 6 - dow };
  if (key in days) {
    const next = new Date(`${date}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + days[key]);
    return next.toISOString().slice(0, 10);
  }
  if (key !== "PageUp" && key !== "PageDown") return null;
  // PageUp/PageDown: 한 달, Shift와 함께: 한 해. 같은 날짜가 없으면 그 달 마지막 날
  const months = (key === "PageUp" ? -1 : 1) * (shift ? 12 : 1);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return ymd(target.getUTCFullYear(), target.getUTCMonth(), Math.min(d, last));
}

export default function Calendar({ selected, onSelect, isSelectable, unavailableReason, today, max, start, note }: Props) {
  const initial = selected ?? (start && start > today ? start : today);
  const [focusDate, setFocusDate] = useState(initial);
  const focusRequested = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const hintId = useId();
  const [ty, tm] = today.split("-").map(Number);
  const [iy, im] = initial.split("-").map(Number);
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

  const navBtn = "flex min-h-11 min-w-11 items-center justify-center rounded-lg p-1.5 transition hover:bg-neutral-100 disabled:opacity-25 disabled:hover:bg-transparent";

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
      <p id={hintId} className="mb-2 text-xs text-neutral-500">방향키로 날짜 이동 · PageUp/PageDown으로 달 이동 · Enter로 선택</p>
      <div aria-hidden="true" className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-neutral-500">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>
      <div role="group" aria-label={`${view.y}년 ${view.m + 1}월`} aria-describedby={hintId} className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const date = ymd(view.y, view.m, d);
          const ok = isSelectable(date);
          const isSel = selected === date;
          const isToday = date === today;
          const reason = ok ? null : unavailableReason?.(date) ?? "예약 불가";
          const extra = ok ? note?.(date) ?? null : null;
          const status = reason ?? (extra ? `선택 가능, ${extra.label}` : "선택 가능");
          return (
            <button
              key={date}
              type="button"
              data-date={date}
              tabIndex={focusDate === date ? 0 : -1}
              aria-disabled={!ok}
              aria-pressed={isSel}
              aria-current={isToday ? "date" : undefined}
              aria-label={`${view.y}년 ${view.m + 1}월 ${d}일 ${WEEKDAYS[new Date(date).getUTCDay()]}요일${isToday ? ", 오늘" : ""}, ${status}`}
              title={status}
              onFocus={() => setFocusDate(date)}
              onClick={() => { if (ok) onSelect(date); }}
              onKeyDown={(event) => {
                const target = keyTarget(date, event.key, event.shiftKey);
                if (!target) return;
                event.preventDefault();
                // 범위 밖이면 끝 날짜에서 멈춘다 (한 달 이동이 막히지 않게)
                const value = target < today ? today : target > max ? max : target;
                if (value === date) return;
                const [vy, vm] = value.split("-").map(Number);
                focusRequested.current = true;
                setFocusDate(value);
                setView({ y: vy, m: vm - 1 });
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
              {extra && (
                <span aria-hidden="true" className={`mt-0.5 block text-[10px] font-semibold leading-tight ${isSel ? "text-neutral-200" : "text-emerald-700"}`}>
                  {extra.text}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
