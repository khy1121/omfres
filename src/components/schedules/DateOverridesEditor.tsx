"use client";

import { Icon } from "@iconify/react";
import { useId, useState } from "react";
import { btnSecondary, ErrorBox, inputCls } from "@/components/ui";
import { fmtDateShort, isValidDate, toMin, weekday, type DateOverride, type TimeWindow } from "@/lib/schedule/rules";

type Range = { start: string; end: string };

type Props = {
  overrides: DateOverride[];
  onChange: (next: DateOverride[]) => void;
  /** 요일별 기본 시간대 (평소 시간 안내용) */
  weekly: TimeWindow[];
  from: string;
  to: string;
  excludeDates: string[];
};

const fmtRanges = (ws: Range[]) => ws.map((w) => `${w.start} ~ ${w.end}`).join(", ");

/** 날짜별 시간 변경: 지정한 날짜는 요일별 시간대 대신 이 시간대로 상담 (이 일정에만 적용) */
export default function DateOverridesEditor({ overrides, onChange, weekly, from, to, excludeDates }: Props) {
  const id = useId();
  const [date, setDate] = useState("");
  const [ranges, setRanges] = useState<Range[]>([{ start: "10:00", end: "12:00" }]);
  const [error, setError] = useState<string | null>(null);

  const usual = (d: string) => weekly.filter((w) => w.days.includes(weekday(d)));

  const add = () => {
    if (!isValidDate(date)) return setError("날짜를 선택해주세요.");
    if (from && to && (date < from || date > to)) return setError("상담 기간 안의 날짜만 넣을 수 있습니다.");
    if (excludeDates.includes(date)) return setError("제외일로 지정된 날짜입니다. 제외일에서 먼저 지워주세요.");
    if (overrides.some((o) => o.date === date)) return setError("이미 시간 변경을 넣은 날짜입니다. 지운 뒤 다시 추가해주세요.");
    if (ranges.some((r) => !r.start || !r.end || toMin(r.start) >= toMin(r.end))) return setError("종료 시각은 시작 시각보다 늦어야 합니다.");
    const sorted = [...ranges].sort((a, b) => toMin(a.start) - toMin(b.start));
    if (sorted.some((r, i) => i > 0 && toMin(sorted[i - 1].end) > toMin(r.start))) return setError("같은 날의 시간대가 서로 겹칩니다.");
    setError(null);
    onChange([...overrides, { date, windows: sorted }].sort((a, b) => a.date.localeCompare(b.date)));
    setDate("");
    setRanges([{ start: "10:00", end: "12:00" }]);
  };

  return (
    <div className="mb-4 border-t border-neutral-100 pt-4">
      <div className="mb-2">
        <div className="text-sm font-medium text-neutral-700">날짜별 시간 변경</div>
        <p className="mt-0.5 text-xs text-neutral-500">
          이 일정에서만, 지정한 날짜는 요일별 시간대 대신 아래 시간으로 상담합니다. 요일에 없는 날도 추가할 수 있습니다.
        </p>
      </div>

      {overrides.length > 0 && (
        <ul className="mb-3 space-y-2" aria-label="날짜별 시간 변경 목록">
          {overrides.map((o) => {
            const base = usual(o.date);
            return (
              <li key={o.date} className="flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                    {fmtDateShort(o.date)}
                    {base.length === 0 && <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-800">추가된 날</span>}
                  </div>
                  <div className="text-sm tabular-nums text-neutral-700">
                    {fmtRanges(o.windows)}
                    {base.length > 0 && <span className="text-neutral-500"> · 평소 {fmtRanges(base)}</span>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onChange(overrides.filter((x) => x.date !== o.date))}
                  className="min-h-11 min-w-11 shrink-0 rounded-lg text-neutral-500 hover:bg-neutral-100"
                  aria-label={`${fmtDateShort(o.date)} 시간 변경 삭제`}
                >
                  <Icon icon="lucide:x" width={18} className="mx-auto" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="space-y-2 rounded-lg border border-dashed border-neutral-300 p-3">
        <label htmlFor={`${id}-date`} className="block text-sm font-medium text-neutral-700">날짜</label>
        <input id={`${id}-date`} type="date" className={inputCls} value={date} min={from || undefined} max={to || undefined} onChange={(e) => { setDate(e.target.value); setError(null); }} />
        {ranges.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="time" step={300} className={`${inputCls} min-w-0`} value={r.start} aria-label={`시간대 ${i + 1} 시작`} onChange={(e) => setRanges(ranges.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} />
            <span className="text-neutral-500">~</span>
            <input type="time" step={300} className={`${inputCls} min-w-0`} value={r.end} aria-label={`시간대 ${i + 1} 종료`} onChange={(e) => setRanges(ranges.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} />
            {ranges.length > 1 && (
              <button type="button" onClick={() => setRanges(ranges.filter((_, j) => j !== i))} className="min-h-11 min-w-11 shrink-0 rounded-lg text-neutral-500 hover:bg-neutral-100" aria-label={`시간대 ${i + 1} 삭제`}>
                <Icon icon="lucide:x" width={18} className="mx-auto" />
              </button>
            )}
          </div>
        ))}
        {ranges.length < 4 && (
          <button type="button" onClick={() => setRanges([...ranges, { start: "14:00", end: "16:00" }])} className="min-h-11 text-sm text-neutral-600 underline-offset-2 hover:underline">
            + 같은 날 시간대 하나 더
          </button>
        )}
        {error && <ErrorBox>{error}</ErrorBox>}
        <button type="button" onClick={add} className={`${btnSecondary} w-full`}>이 날짜 시간 변경 추가</button>
      </div>
    </div>
  );
}
