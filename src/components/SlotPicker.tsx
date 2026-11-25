"use client";

import { useEffect, useRef, useState } from "react";
import Calendar from "./Calendar";
import { btnPrimary, btnSecondary, ErrorBox, StepHeader } from "./ui";
import { CONFIG, dateUnavailableReason, isDateSelectable, lastBookableDate, Professor } from "@/lib/config";
import { addMinutes, fmtDate } from "@/lib/format";
import { canChangeReservation } from "@/lib/reservation-time";

type Slot = { time: string; available: boolean; reason?: "past" | "booked" | null };
export type SlotSelection = { date: string; time: string | null };
type Props = {
  today: string;
  professor: Professor;
  current?: { date: string; time: string };
  selection?: SlotSelection | null;
  onSelectionChange?: (selection: SlotSelection) => void;
  stage?: "date" | "time";
  onStageChange?: (stage: "date" | "time") => void;
  onBack?: () => void;
  onPick: (date: string, time: string) => void | Promise<void>;
  confirmLabel?: string;
  busy?: boolean;
  blocked?: boolean;
  refreshVersion?: number;
  error?: string | null;
};

export default function SlotPicker({ today, professor, current, selection, onSelectionChange, stage: controlledStage,
  onStageChange, onBack, onPick, confirmLabel = "선택한 일정으로 계속", busy = false, blocked = false,
  refreshVersion = 0, error }: Props) {
  const [localSelection, setLocalSelection] = useState<SlotSelection | null>(selection ?? current ?? null);
  const draft = selection === undefined ? localSelection : selection;
  const [localStage, setLocalStage] = useState<"date" | "time">("date");
  const stage = controlledStage ?? localStage;
  const setStage = (next: "date" | "time") => { setLocalStage(next); onStageChange?.(next); };
  const choose = (next: SlotSelection) => { setLocalSelection(next); onSelectionChange?.(next); };
  const date = draft?.date ?? null;
  const time = draft?.time ?? null;
  const [result, setResult] = useState<{ key: string; slots: Slot[]; error?: string } | null>(null);
  const [retry, setRetry] = useState(0);
  const key = `${professor.id}:${date}:${refreshVersion}:${retry}`;
  const loading = stage === "time" && result?.key !== key;
  const slots = result?.key === key ? result.slots : [];
  const loadError = result?.key === key ? result.error : null;
  const submitting = useRef(false);

  useEffect(() => {
    if (stage !== "time" || !date) return;
    const controller = new AbortController();
    let active = true;
    async function load() {
      try {
        const response = await fetch(`/api/slots?professor=${encodeURIComponent(professor.id)}&date=${date}`, {
          cache: "no-store", signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "시간 정보를 불러오지 못했습니다.");
        if (active) setResult({ key, slots: data.slots ?? [] });
      } catch (e) {
        if (active) setResult({ key, slots: [], error: e instanceof Error ? e.message : "시간 정보를 불러오지 못했습니다." });
      }
    }
    void load();
    return () => { active = false; controller.abort(); };
  }, [date, professor.id, key, stage]);

  const enabled = (s: Slot) => s.available || (
    current?.date === date && current.time === s.time && canChangeReservation(current));
  const canConfirm = !!time && slots.some((s) => s.time === time && enabled(s)) &&
    !(current?.date === date && current.time === time) && !loading && !loadError;

  return (
    <div aria-busy={busy}>
      {error && <ErrorBox>{error}</ErrorBox>}
      <fieldset disabled={busy || blocked} className="min-w-0">
        <StepHeader title={stage === "date" ? "상담 날짜를 선택하세요" : "시작 시간을 선택하세요"}
          onBack={stage === "date" ? onBack : () => setStage("date")} />
        <p className="mb-4 text-sm text-neutral-600">{professor.name} · 상담 {professor.slotMinutes}분</p>
        {professor.note && <p className="mb-4 text-xs text-neutral-500">{professor.note}</p>}
        {stage === "date" ? (
          <>
            <Calendar selected={date} today={today} max={lastBookableDate(today)} isSelectable={(d) => isDateSelectable(professor, d, today)}
              unavailableReason={(d) => dateUnavailableReason(professor, d, today)}
              onSelect={(d) => { choose({ date: d, time: d === date ? time : null }); setStage("time"); }} />
            <p className="mt-4 text-xs text-neutral-500">{today} ~ {lastBookableDate(today)} · 오늘부터 {CONFIG.maxDaysAhead}일 이내로 예약할 수 있습니다. 잔여 시간은 날짜 선택 후 확인합니다.</p>
          </>
        ) : (
          <>
            <p className="mb-4 text-sm">{date && fmtDate(date)}</p>
            {loading ? <p role="status" className="py-10 text-center text-sm">시간을 불러오는 중</p> : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.map((s) => (
                  <button key={s.time} type="button" disabled={!enabled(s)} aria-pressed={time === s.time}
                    aria-label={enabled(s) ? s.time : `${s.time} ${s.reason === "past" ? "지난 시간" : s.reason === "booked" ? "예약 마감" : "예약 불가"}`}
                    onClick={() => date && choose({ date, time: s.time })}
                    className={`min-h-11 rounded-lg border py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      time === s.time ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 hover:border-neutral-900"
                    }`}>
                    {s.time}
                    {!enabled(s) && <span className="mt-1 block text-xs">{s.reason === "past" ? "지난 시간" : s.reason === "booked" ? "예약 마감" : "예약 불가"}</span>}
                  </button>
                ))}
              </div>
            )}
            {loadError && <div className="mt-4"><ErrorBox>{loadError}</ErrorBox>
              <button type="button" onClick={() => setRetry((v) => v + 1)} className={btnSecondary}>다시 불러오기</button>
            </div>}
            {!loading && !loadError && slots.every((s) => !enabled(s)) && (
              <div className="mt-4 text-sm">
                <p role="status">{slots.length === 0 ? "등록된 상담 시간이 없습니다." : slots.every((s) => s.reason === "past") ? "오늘의 상담 시작 시간이 모두 지났습니다." : "예약 가능한 시간이 모두 마감되었습니다."}</p>
                <button type="button" onClick={() => setStage("date")} className={`${btnSecondary} mt-3`}>다른 날짜 선택</button>
              </div>
            )}
            {date && time && (
              <div className="mt-5 rounded-lg bg-neutral-100 p-3 text-sm" aria-live="polite">
                {current && <p className="mb-2 text-neutral-600">기존 일정: {fmtDate(current.date)} {current.time} ~ {addMinutes(current.time, professor.slotMinutes)}</p>}
                <p className="font-semibold">{current ? "변경할 일정" : "선택한 일정"}: {fmtDate(date)} {time} ~ {addMinutes(time, professor.slotMinutes)}</p>
                {current?.date === date && current.time === time && <p className="mt-1">현재 예약과 같습니다. 변경할 시간을 선택해주세요.</p>}
                {!loading && !loadError && !slots.some((s) => s.time === time && enabled(s)) && <p className="mt-1">선택한 시간은 예약할 수 없습니다. 다른 시간을 선택해주세요.</p>}
              </div>
            )}
            <button type="button" disabled={!canConfirm || busy || blocked} className={`${btnPrimary} mt-4 w-full`}
              onClick={async () => {
                if (!date || !time || submitting.current || !canConfirm) return;
                submitting.current = true;
                try { await onPick(date, time); } finally { submitting.current = false; }
              }}>
              {busy ? "저장 중" : confirmLabel}
            </button>
          </>
        )}
      </fieldset>
    </div>
  );
}
