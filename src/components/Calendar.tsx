"use client";

import { Icon } from "@iconify/react";
import { useState } from "react";
import { WEEKDAYS } from "@/lib/format";

type Props = {
  selected: string | null;
  onSelect: (date: string) => void;
  isSelectable: (date: string) => boolean;
  today: string;
};

function ymd(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export default function Calendar({ selected, onSelect, isSelectable, today }: Props) {
  const [ty, tm] = today.split("-").map(Number);
  const [iy, im] = (selected ?? today).split("-").map(Number);
  const [view, setView] = useState({ y: iy, m: im - 1 });

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
  };
  const isCurrentOrPastMonth = view.y < ty || (view.y === ty && view.m <= tm - 1);

  const navBtn = "rounded-lg p-1.5 transition hover:bg-neutral-100 disabled:opacity-25 disabled:hover:bg-transparent";

  return (
    <div className="select-none">
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => move(-1)} disabled={isCurrentOrPastMonth} className={navBtn} aria-label="이전 달">
          <Icon icon="lucide:chevron-left" width={20} />
        </button>
        <div className="font-semibold tracking-tight">
          {view.y}년 {view.m + 1}월
        </div>
        <button type="button" onClick={() => move(1)} className={navBtn} aria-label="다음 달">
          <Icon icon="lucide:chevron-right" width={20} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-neutral-500">
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
          return (
            <button
              key={date}
              type="button"
              disabled={!ok}
              onClick={() => onSelect(date)}
              className={[
                "aspect-square rounded-lg text-sm transition",
                isSel
                  ? "bg-neutral-900 font-semibold text-white"
                  : ok
                    ? "text-neutral-900 hover:bg-neutral-100"
                    : "cursor-not-allowed text-neutral-300",
                isToday && !isSel ? "ring-1 ring-neutral-900" : "",
              ].join(" ")}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}
