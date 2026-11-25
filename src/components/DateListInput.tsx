"use client";

import { useId, useState } from "react";
import { isValidDate } from "@/lib/config";
import { btnSecondary, ErrorBox, inputCls } from "./ui";

export default function DateListInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const dates = value.split(/[\n,\s]+/).filter(Boolean);
  return <div className="mb-4">
    <label htmlFor={id} className="mb-1.5 block text-sm font-medium">{label}</label>
    <div className="flex gap-2">
      <input id={id} type="date" value={draft} onChange={(e) => { setDraft(e.target.value); setError(null); }} className={`${inputCls} min-w-0`} />
      <button type="button" className={btnSecondary} onClick={() => {
        if (!isValidDate(draft)) { setError("추가할 날짜를 선택해주세요."); return; }
        if (dates.includes(draft)) { setError("이미 추가한 날짜입니다."); return; }
        onChange([...dates, draft].sort().join("\n")); setDraft(""); setError(null);
      }}>추가</button>
    </div>
    {error && <div className="mt-2"><ErrorBox>{error}</ErrorBox></div>}
    <ul aria-label={`${label} 목록`} className="mt-2 space-y-1">
      {dates.map((date, index) => <li key={`${date}-${index}`} className="flex items-center justify-between rounded-lg bg-neutral-100 px-2 py-1 text-sm">
        <span>{date}{!isValidDate(date) && " · 잘못된 날짜"}</span>
        <button type="button" aria-label={`${label} ${date} 제거`} className="rounded px-2 py-1" onClick={() => onChange(dates.filter((_, i) => i !== index).join("\n"))}>제거</button>
      </li>)}
    </ul>
    {!dates.length && <p className="mt-2 text-xs text-neutral-500">선택한 날짜 없음</p>}
  </div>;
}
