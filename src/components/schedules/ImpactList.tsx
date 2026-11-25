import { Icon } from "@iconify/react";
import { fmtDateShort } from "@/lib/schedule/rules";

export type ImpactItem = { id: string; date: string; time: string; studentName: string; studentNo: string | null; reason: "no_slot" | "audience" };

const REASON = { no_slot: "새 규칙에 없는 시간", audience: "공개 대상에서 제외" };

export default function ImpactList({ items }: { items: ImpactItem[] }) {
  return (
    <div role="alert">
      <h3 className="mb-2 flex items-center gap-2 font-bold text-amber-900">
        <Icon icon="lucide:triangle-alert" width={18} />
        영향을 받는 예정 예약 {items.length}건
      </h3>
      <ul className="divide-y divide-amber-100 rounded-lg border border-amber-200 bg-amber-50 text-sm">
        {items.map((b) => (
          <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2">
            <span className="font-medium tabular-nums">{fmtDateShort(b.date)} {b.time}</span>
            <span>{b.studentName} <span className="tabular-nums text-neutral-500">{b.studentNo}</span></span>
            <span className="ml-auto text-xs text-amber-900">{REASON[b.reason]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
