"use client";

import { Icon } from "@iconify/react";
import { StepHeader } from "./ui";
import { useProfessors } from "./ProfessorsProvider";
import { fmtDays, Professor } from "@/lib/config";

export default function ProfessorPicker({ onPick }: { onPick: (p: Professor) => void }) {
  const PROFESSORS = useProfessors();
  return (
    <>
      <StepHeader title="상담하실 교수님을 선택하세요" />
      {PROFESSORS.length === 0 && <p className="py-6 text-center text-sm text-neutral-500">등록된 교수님이 없습니다.</p>}
      <ul className="space-y-2">
        {PROFESSORS.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onPick(p)}
              className="flex w-full items-center gap-3 rounded-xl border border-neutral-300 px-4 py-3 text-left transition hover:border-neutral-900 hover:bg-neutral-50"
            >
              <span className="min-w-0 flex-1 break-words">
                <span className="mb-2 block text-base font-semibold">{p.name}</span>
                {p.availability.map((a, i) => <span key={i} className="block text-sm text-neutral-700">{fmtDays(a.days)} · {a.start}–{a.end}</span>)}
                <span className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-md bg-neutral-100 px-2 py-1 font-semibold">{p.slotMinutes}분 상담</span>
                  {p.office && <span className="text-neutral-600">{p.office}</span>}
                </span>
                {(p.onlyDates?.length || p.excludeDates?.length) ? <span className="mt-3 block border-t border-neutral-100 pt-2 text-xs leading-relaxed text-neutral-600">
                  {!!p.onlyDates?.length && <span className="block">지정일만 예약: {p.onlyDates.join(", ")}</span>}
                  {!!p.excludeDates?.length && <span className="block">예약 제외일: {p.excludeDates.join(", ")}</span>}
                </span> : null}
                {p.note && <span className="mt-2 block text-xs leading-relaxed text-neutral-500">추가 안내: {p.note}</span>}
              </span>
              <Icon icon="lucide:chevron-right" width={18} className="shrink-0 text-neutral-400" />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
