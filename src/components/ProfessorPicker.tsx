"use client";

import { Icon } from "@iconify/react";
import { StepHeader } from "./ui";
import { Professor, PROFESSORS } from "@/lib/config";

export default function ProfessorPicker({ onPick }: { onPick: (p: Professor) => void }) {
  return (
    <>
      <StepHeader title="상담하실 교수님을 선택하세요" />
      <ul className="space-y-2">
        {PROFESSORS.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onPick(p)}
              className="flex w-full items-center gap-3 rounded-xl border border-neutral-300 px-4 py-3 text-left transition hover:border-neutral-900 hover:bg-neutral-50"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white">
                <Icon icon="lucide:graduation-cap" width={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{p.name}</span>
                {p.note && <span className="block text-sm text-neutral-500">{p.note}</span>}
              </span>
              <Icon icon="lucide:chevron-right" width={18} className="shrink-0 text-neutral-400" />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
