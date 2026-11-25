import { Icon } from "@iconify/react";
import Link from "next/link";
import { countSlots, describeRule } from "@/lib/schedule/rules";
import type { Schedule, ScheduleStatus } from "@/lib/data/schedules";

export const STATUS_BADGE: Record<ScheduleStatus, { label: string; cls: string }> = {
  draft: { label: "비공개", cls: "bg-neutral-200 text-neutral-700" },
  open: { label: "예약 받는 중", cls: "bg-emerald-700 text-white" },
  closed: { label: "마감", cls: "bg-neutral-500 text-white" },
};

function hoursLabel(h: number, what: string) {
  if (h === 0) return `상담 시작 전까지 ${what}`;
  if (h % 24 === 0) return `상담 ${h / 24}일 전까지 ${what}`;
  return `상담 ${h}시간 전까지 ${what}`;
}

/** 일정 정보 (학생·교수 공용). showAdmin이면 상태·대상 인원 등 관리 정보도 표시 */
export function ScheduleDetails({ s, showAdmin, audienceCount }: { s: Schedule; showAdmin?: boolean; audienceCount?: number }) {
  const rows: { icon: string; text: React.ReactNode }[] = [
    { icon: "lucide:calendar-range", text: describeRule(s) },
    { icon: "lucide:timer", text: `${s.slotMinutes}분 상담` },
    {
      icon: s.mode === "online" ? "lucide:video" : "lucide:map-pin",
      text: s.mode === "online" ? `온라인${s.location ? ` · ${s.location}` : ""}` : s.location,
    },
    { icon: "lucide:repeat", text: `1인당 ${s.maxBookingsPerStudent}회 예약 · ${hoursLabel(s.bookingCloseHours, "예약")} · ${hoursLabel(s.cancelCloseHours, "변경·취소")}` },
  ];
  if (showAdmin) {
    rows.push({ icon: "lucide:users", text: s.audience === "all" ? "그룹 전체 학생에게 공개" : `선택한 학생 ${audienceCount ?? s.audienceIds.length}명에게만 공개` });
    rows.push({ icon: "lucide:clock", text: `상담 시간 총 ${countSlots(s)}개` });
  }
  return (
    <ul className="space-y-1.5 text-sm text-neutral-700">
      {rows.map((r, i) => (
        <li key={i} className="flex items-start gap-2">
          <Icon icon={r.icon} width={16} className="mt-0.5 shrink-0 text-neutral-500" />
          <span className="min-w-0 break-words">{r.text}</span>
        </li>
      ))}
    </ul>
  );
}

/** 그룹 화면의 일정 카드 */
export function ScheduleCard({ s, href, showStatus, footer }: { s: Schedule; href: string; showStatus?: boolean; footer?: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="block rounded-2xl border border-neutral-200 bg-white p-4 transition hover:border-neutral-900">
        <div className="mb-2 flex items-start gap-2">
          <span className="min-w-0 flex-1 font-semibold">{s.title}</span>
          {showStatus && <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[s.status].cls}`}>{STATUS_BADGE[s.status].label}</span>}
          <Icon icon="lucide:chevron-right" width={18} className="shrink-0 text-neutral-400" />
        </div>
        <ScheduleDetails s={s} />
        {footer && <div className="mt-3 border-t border-neutral-100 pt-2 text-sm">{footer}</div>}
      </Link>
    </li>
  );
}
