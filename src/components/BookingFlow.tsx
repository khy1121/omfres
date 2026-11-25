"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";
import { useState } from "react";
import ProfessorPicker from "./ProfessorPicker";
import SlotPicker, { SlotSelection } from "./SlotPicker";
import { useBookingNavigation } from "./useBookingNavigation";
import { useReservationSave } from "./useReservationSave";
import ReservationRecovery from "./ReservationRecovery";
import { useReservationLookup } from "./ProfessorsProvider";
import { btnPrimary, btnSecondary, Card, ErrorBox, Field, inputCls, StepHeader } from "./ui";
import { generateTimeSlots, isDateSelectable, Professor } from "@/lib/config";
import { addMinutes, fmtDate } from "@/lib/format";

type Step = 1 | 2 | 3 | 4;

export default function BookingFlow({ today }: { today: string }) {
  const [professor, setProfessor] = useState<Professor | null>(null);
  const [selection, setSelection] = useState<SlotSelection | null>(null);
  const date = selection?.date ?? null;
  const time = selection?.time ?? null;
  const [name, setName] = useState("");
  const navigation = useBookingNavigation();
  const lookup = useReservationLookup();
  const mutation = useReservationSave((saved) => { lookup.setName(saved.name); navigation.finish(); }, navigation.setBlocked, () => navigation.back(2, "time"));
  const step = !professor && navigation.step !== 4 ? 1 : navigation.step === 3 && (!date || !time) ? 2 : navigation.step;

  const submit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!professor || !date || !time) return;
    const expected = { professorId: professor.id, date, time, name: name.trim() };
    await mutation.save({ url: "/api/reservations", method: "POST", body: expected,
      lookupUrl: `/api/reservations?name=${encodeURIComponent(name.trim())}`, expected });
  };

  const reset = () => {
    navigation.reset();
    setProfessor(null);
    setSelection(null);
    setName("");
  };

  const steps = [
    { label: "교수님", icon: "lucide:graduation-cap" },
    { label: "일정", icon: "lucide:calendar-days" },
    { label: "정보 입력", icon: "lucide:user" },
    { label: "완료", icon: "lucide:check" },
  ];

  const summary = professor && date && time && (
    <div className="mb-5 rounded-lg bg-neutral-100 p-3 text-sm">
      <div className="flex items-center gap-1.5 font-semibold">
        <Icon icon="lucide:graduation-cap" width={16} />
        {professor.name}
      </div>
      <div className="mt-1 text-neutral-600">{fmtDate(date)}</div>
      <div className="font-semibold">
        {time} ~ {addMinutes(time, professor.slotMinutes)}
      </div>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-md">
      <ol className="mb-6 flex items-center text-xs">
        {steps.map((s, i) => {
          const n = (i + 1) as Step;
          const active = step === n;
          const done = step > n;
          return (
            <li key={s.label} aria-current={active ? "step" : undefined} className="flex flex-1 items-center last:flex-none">
              <div className="flex items-center gap-1.5">
                <span
                  className={[
                    "flex h-7 w-7 items-center justify-center rounded-full border",
                    active || done ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 text-neutral-400",
                  ].join(" ")}
                >
                  <Icon icon={done ? "lucide:check" : s.icon} width={14} />
                </span>
                <span className={active ? "font-semibold text-neutral-900" : "text-neutral-500"}>{s.label}</span>
              </div>
              {i < steps.length - 1 && <div className={`mx-2 h-px flex-1 ${done ? "bg-neutral-900" : "bg-neutral-200"}`} />}
            </li>
          );
        })}
      </ol>

      <Card>
        {step !== 4 && mutation.error && <ErrorBox>{mutation.error}</ErrorBox>}
        <ReservationRecovery mutation={mutation} />
        {step === 1 && (
          <ProfessorPicker
            onPick={(p) => {
              if (professor?.id !== p.id && selection) {
                setSelection(isDateSelectable(p, selection.date, today) ? {
                  date: selection.date,
                  time: selection.time && generateTimeSlots(p, selection.date).includes(selection.time) ? selection.time : null,
                } : null);
              }
              setProfessor(p);
              navigation.go(2);
            }}
          />
        )}

        {step === 2 && professor && (
          <SlotPicker
            key={professor.id}
            today={today}
            professor={professor}
            selection={selection}
            onSelectionChange={setSelection}
            stage={navigation.stage}
            onStageChange={(stage) => stage === "date" ? navigation.back(2) : navigation.go(2, "time")}
            refreshVersion={mutation.refreshVersion}
            busy={mutation.busy}
            blocked={mutation.pending}
            onBack={() => navigation.back(1)}
            onPick={() => navigation.go(3)}
          />
        )}

        {step === 3 && professor && date && time && (
          <form onSubmit={submit}>
            <fieldset disabled={mutation.busy || mutation.pending} className="min-w-0">
            <StepHeader title="정보를 입력하세요" onBack={() => navigation.back(2, "time")} />
            {summary}
            <Field label="이름" icon="lucide:user">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="홍길동"
                required
                minLength={2}
                maxLength={20}
                className={inputCls}
              />
            </Field>
            {mutation.error && !mutation.pending && <button type="button" onClick={() => navigation.back(2, "time")} className={`${btnSecondary} mb-3 w-full`}>다른 시간 선택</button>}
            <button type="submit" disabled={mutation.busy || mutation.pending} className={`${btnPrimary} w-full`}>
              <Icon icon={mutation.busy ? "lucide:loader-2" : "lucide:check"} width={18} className={mutation.busy ? "animate-spin" : ""} />
              {mutation.busy ? "예약 중" : "예약하기"}
            </button>
            </fieldset>
          </form>
        )}

        {step === 4 && professor && date && time && (
          <div className="py-2 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-900 text-white">
              <Icon icon="lucide:check" width={28} />
            </div>
            <StepHeader title="예약이 완료되었습니다" />
            <div className="mb-6 rounded-lg bg-neutral-100 p-4 text-sm">
              <div className="mt-1 text-neutral-600">{fmtDate(date)}</div>
              <div className="text-base font-semibold">
                {time} ~ {addMinutes(time, professor.slotMinutes)}
              </div>
              <div className="mt-2 font-semibold">{professor.name}</div>
              {(professor.office || professor.phone) && (
                <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 border-t border-neutral-200 pt-3 text-xs text-neutral-600">
                  {professor.office && (
                    <span className="flex items-center gap-1">
                      <Icon icon="lucide:map-pin" width={13} />
                      {professor.office}
                    </span>
                  )}
                  {professor.phone && (
                    <a href={`tel:${professor.phone}`} className="flex items-center gap-1 hover:underline">
                      <Icon icon="lucide:phone" width={13} />
                      {professor.phone}
                    </a>
                  )}
                </div>
              )}
              <div className="mt-3 text-neutral-600">예약자: {name}</div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={reset} className={`${btnSecondary} flex-1`}>
                <Icon icon="lucide:plus" width={16} />
                다른 상담 예약
              </button>
              <Link href="/my" className={`${btnPrimary} flex-1`}>
                <Icon icon="lucide:list" width={16} />
                내 예약 확인
              </Link>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
