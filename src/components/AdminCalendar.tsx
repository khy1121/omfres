"use client";

import { Icon } from "@iconify/react";
import { useMemo, useState } from "react";
import { btnPrimary, btnSecondary } from "./ui";
import { PROFESSORS } from "@/lib/config";
import { fmtDate, fmtRange, profName, WEEKDAYS } from "@/lib/format";
import type { Reservation } from "@/lib/store";

/** 교수님별 흑백 스타일 (범례와 캘린더 칩에 공통 사용) */
export const PROF_STYLE: Record<string, string> = {
  jeon: "bg-neutral-900 text-white border-neutral-900",
  jung: "bg-white text-neutral-900 border-neutral-900",
  choi: "bg-neutral-200 text-neutral-900 border-neutral-200",
};
const profStyle = (id: string) => PROF_STYLE[id] ?? "bg-neutral-100 text-neutral-900 border-neutral-100";

type Props = {
  rows: Reservation[];
  today: string;
  /** "all" 이면 교수님 칩 표시, 아니면 해당 교수님만 */
  profFilter: string;
  busy: boolean;
  onDelete: (id: string) => Promise<void>;
};

function ymd(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export default function AdminCalendar({ rows, today, profFilter, busy, onDelete }: Props) {
  const [ty, tm] = today.split("-").map(Number);
  const [view, setView] = useState({ y: ty, m: tm - 1 });
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const byDate = useMemo(() => {
    const m = new Map<string, Reservation[]>();
    for (const r of rows) {
      const list = m.get(r.date) ?? [];
      list.push(r);
      m.set(r.date, list);
    }
    for (const list of m.values()) list.sort((a, b) => a.time.localeCompare(b.time) || a.professorId.localeCompare(b.professorId));
    return m;
  }, [rows]);

  const first = new Date(Date.UTC(view.y, view.m, 1));
  const startPad = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array(startPad).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  const move = (delta: number) => {
    const d = new Date(Date.UTC(view.y, view.m + delta, 1));
    setView({ y: d.getUTCFullYear(), m: d.getUTCMonth() });
    setSelected(null);
  };

  const monthCount = [...byDate.entries()]
    .filter(([d]) => d.startsWith(`${view.y}-${String(view.m + 1).padStart(2, "0")}`))
    .reduce((n, [, l]) => n + l.length, 0);

  const selectedRows = selected ? (byDate.get(selected) ?? []) : [];
  const navBtn = "rounded-lg p-1.5 transition hover:bg-neutral-100";

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => move(-1)} className={navBtn} aria-label="이전 달">
          <Icon icon="lucide:chevron-left" width={20} />
        </button>
        <div className="text-center">
          <div className="font-semibold tracking-tight">
            {view.y}년 {view.m + 1}월
          </div>
          <div className="text-xs text-neutral-500">이달 {monthCount}건</div>
        </div>
        <button type="button" onClick={() => move(1)} className={navBtn} aria-label="다음 달">
          <Icon icon="lucide:chevron-right" width={20} />
        </button>
      </div>

      {profFilter === "all" && (
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          {PROFESSORS.map((p) => (
            <span key={p.id} className="flex items-center gap-1.5">
              <span className={`inline-block h-3 w-3 rounded-sm border ${profStyle(p.id)}`} />
              {p.name}
            </span>
          ))}
        </div>
      )}

      <div>
        <div>
          <div className="grid grid-cols-7 text-center text-xs font-medium text-neutral-500">
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-1">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-neutral-200 bg-neutral-200">
            {cells.map((d, i) => {
              if (d === null) return <div key={i} className="min-h-14 bg-neutral-50 sm:min-h-24" />;
              const date = ymd(view.y, view.m, d);
              const list = byDate.get(date) ?? [];
              const isToday = date === today;
              const isSel = selected === date;
              const past = date < today;
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => {
                    setSelected(isSel ? null : date);
                    setConfirmId(null);
                  }}
                  className={[
                    "flex min-h-14 flex-col items-stretch gap-0.5 bg-white p-0.5 text-left transition sm:min-h-24 sm:p-1",
                    isSel ? "ring-2 ring-neutral-900 ring-inset" : "hover:bg-neutral-50",
                    past ? "text-neutral-400" : "",
                  ].join(" ")}
                >
                  <span className={`mb-0.5 self-start rounded-full px-1.5 text-xs ${isToday ? "bg-neutral-900 font-semibold text-white" : ""}`}>
                    {d}
                  </span>
                  {/* 모바일: 건수 + 교수님 점 */}
                  {list.length > 0 && (
                    <span className="flex flex-col items-center gap-0.5 sm:hidden">
                      <span className="text-sm font-semibold leading-none">{list.length}</span>
                      {profFilter === "all" && (
                        <span className="flex gap-0.5">
                          {PROFESSORS.filter((p) => list.some((r) => r.professorId === p.id)).map((p) => (
                            <span key={p.id} className={`inline-block h-1.5 w-1.5 rounded-full border ${profStyle(p.id)}`} />
                          ))}
                        </span>
                      )}
                    </span>
                  )}
                  {/* 데스크톱: 시간 + 이름 */}
                  <span className="hidden flex-col gap-0.5 sm:flex">
                    {list.slice(0, 6).map((r) => (
                      <span
                        key={r.id}
                        className={`truncate rounded border px-1 text-[11px] leading-4 ${profFilter === "all" ? profStyle(r.professorId) : "border-neutral-300 bg-neutral-50"}`}
                        title={`${profName(r.professorId)} ${r.time} ${r.name}`}
                      >
                        {r.time} {r.name}
                      </span>
                    ))}
                    {list.length > 6 && <span className="px-1 text-[11px] text-neutral-500">+{list.length - 6}건</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <p className="mt-2 text-xs text-neutral-500 sm:hidden">날짜를 누르면 그날 예약 목록이 아래에 표시됩니다.</p>
      </div>

      {selected && (
        <div className="mt-4 rounded-xl border border-neutral-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 font-semibold">
              <Icon icon="lucide:calendar" width={16} />
              {fmtDate(selected)} <span className="text-sm font-normal text-neutral-500">{selectedRows.length}건</span>
            </h3>
            <button type="button" onClick={() => setSelected(null)} className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100" aria-label="닫기">
              <Icon icon="lucide:x" width={16} />
            </button>
          </div>
          {selectedRows.length === 0 ? (
            <p className="text-sm text-neutral-500">이 날짜에는 예약이 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {selectedRows.map((r) => (
                <li key={r.id} className="flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm">
                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className={`shrink-0 rounded border px-1.5 py-0.5 text-xs ${profStyle(r.professorId)}`}>{profName(r.professorId).replace(" 교수님", "")}</span>
                    <span className="font-semibold">{r.name}</span>
                    <span className="text-neutral-600">{fmtRange(r.professorId, r.time)}</span>
                  </span>
                  {confirmId === r.id ? (
                    <span className="flex gap-1">
                      <button type="button" onClick={() => setConfirmId(null)} className={`${btnSecondary} px-2.5 py-1 text-xs`}>
                        아니오
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          await onDelete(r.id);
                          setConfirmId(null);
                        }}
                        className={`${btnPrimary} px-2.5 py-1 text-xs`}
                      >
                        삭제
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmId(r.id)}
                      className="rounded-md p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900"
                      aria-label="예약 삭제"
                    >
                      <Icon icon="lucide:trash-2" width={16} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
