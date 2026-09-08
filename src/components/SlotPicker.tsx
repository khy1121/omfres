"use client";

import { Icon } from "@iconify/react";
import { useState } from "react";
import Calendar from "./Calendar";
import { ErrorBox, StepHeader } from "./ui";
import { CONFIG, isDateSelectable } from "@/lib/config";
import { fmtDate } from "@/lib/format";

type Slot = { time: string; available: boolean };

type Props = {
  today: string;
  /** 수정 모드일 때 현재 예약 (해당 슬롯은 선택 가능하게 표시) */
  current?: { date: string; time: string };
  /** 첫 단계(날짜)에서 뒤로가기를 눌렀을 때. 없으면 버튼 숨김 */
  onBack?: () => void;
  onPick: (date: string, time: string) => void;
  /** 외부(예: 409 충돌)에서 보여줄 에러 */
  error?: string | null;
};

export default function SlotPicker({ today, current, onBack, onPick, error }: Props) {
  const [date, setDate] = useState<string | null>(current?.date ?? null);
  const [stage, setStage] = useState<"date" | "time">("date");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const pickDate = async (d: string) => {
    setDate(d);
    setStage("time");
    setLoading(true);
    setLoadError(null);
    setSlots([]);
    try {
      const res = await fetch(`/api/slots?date=${d}`, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setSlots(j.slots ?? []);
    } catch (e) {
      setLoadError(e instanceof Error && e.message ? e.message : "시간 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (stage === "date") {
    return (
      <>
        <StepHeader title="상담 날짜를 선택하세요" onBack={onBack} />
        <Calendar selected={date} onSelect={pickDate} isSelectable={isDateSelectable} today={today} />
        <p className="mt-4 flex items-center gap-1.5 text-xs text-neutral-500">
          <Icon icon="lucide:info" width={14} />
          평일만 예약 가능하며, 오늘부터 {CONFIG.maxDaysAhead}일 이내로 예약할 수 있습니다.
        </p>
      </>
    );
  }

  const isCurrent = (t: string) => current?.date === date && current?.time === t;
  const noneAvailable = !loading && slots.length > 0 && slots.every((s) => !s.available && !isCurrent(s.time));

  return (
    <>
      <StepHeader title="시작 시간을 선택하세요" onBack={() => setStage("date")} />
      <p className="mb-4 flex items-center gap-1.5 text-sm text-neutral-600">
        <Icon icon="lucide:calendar" width={16} />
        {date && fmtDate(date)}
        <span className="text-neutral-300">|</span>
        <Icon icon="lucide:clock" width={16} />
        상담 {CONFIG.slotMinutes}분
      </p>
      {error && <ErrorBox>{error}</ErrorBox>}
      {loadError && <ErrorBox>{loadError}</ErrorBox>}
      {loading ? (
        <p className="flex items-center justify-center gap-2 py-10 text-sm text-neutral-500">
          <Icon icon="lucide:loader-2" width={18} className="animate-spin" />
          불러오는 중
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {slots.map((s) => {
            const mine = isCurrent(s.time);
            const enabled = s.available || mine;
            return (
              <button
                key={s.time}
                type="button"
                disabled={!enabled}
                onClick={() => date && onPick(date, s.time)}
                className={[
                  "rounded-lg border py-2.5 text-sm font-medium transition",
                  mine
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : enabled
                      ? "border-neutral-300 text-neutral-900 hover:border-neutral-900 hover:bg-neutral-50"
                      : "cursor-not-allowed border-neutral-100 text-neutral-300 line-through",
                ].join(" ")}
              >
                {s.time}
              </button>
            );
          })}
        </div>
      )}
      {noneAvailable && <p className="mt-5 text-center text-sm text-neutral-500">예약 가능한 시간이 없습니다.</p>}
    </>
  );
}
