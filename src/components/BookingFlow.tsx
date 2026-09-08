"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";
import { useState } from "react";
import ProfessorPicker from "./ProfessorPicker";
import SlotPicker from "./SlotPicker";
import { btnPrimary, btnSecondary, Card, ErrorBox, Field, inputCls, StepHeader } from "./ui";
import { Professor } from "@/lib/config";
import { addMinutes, fmtDate } from "@/lib/format";

type Step = 1 | 2 | 3 | 4;

export default function BookingFlow({ today }: { today: string }) {
  const [step, setStep] = useState<Step>(1);
  const [pickerKey, setPickerKey] = useState(0);
  const [professor, setProfessor] = useState<Professor | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);

  const submit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ professorId: professor?.id, date, time, studentId, name }),
      });
      const j = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setConflict(j.error);
          setPickerKey((k) => k + 1);
          setStep(2);
        } else {
          setError(j.error ?? "예약에 실패했습니다.");
        }
        return;
      }
      setStep(4);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setStep(1);
    setPickerKey((k) => k + 1);
    setProfessor(null);
    setDate(null);
    setTime(null);
    setStudentId("");
    setName("");
    setError(null);
    setConflict(null);
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
            <li key={s.label} className="flex flex-1 items-center last:flex-none">
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
        {step === 1 && (
          <ProfessorPicker
            onPick={(p) => {
              setProfessor(p);
              setDate(null);
              setTime(null);
              setConflict(null);
              setPickerKey((k) => k + 1);
              setStep(2);
            }}
          />
        )}

        {step === 2 && professor && (
          <SlotPicker
            key={pickerKey}
            today={today}
            professor={professor}
            error={conflict}
            onBack={() => setStep(1)}
            onPick={(d, t) => {
              setDate(d);
              setTime(t);
              setConflict(null);
              setStep(3);
            }}
          />
        )}

        {step === 3 && professor && date && time && (
          <form onSubmit={submit}>
            <StepHeader title="정보를 입력하세요" onBack={() => setStep(2)} />
            {summary}
            <Field label="학번" icon="lucide:hash">
              <input
                value={studentId}
                onChange={(e) => setStudentId(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                placeholder="예: 2024123"
                required
                minLength={6}
                maxLength={10}
                className={inputCls}
              />
            </Field>
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
            {error && <ErrorBox>{error}</ErrorBox>}
            <button type="submit" disabled={submitting} className={`${btnPrimary} w-full`}>
              <Icon icon={submitting ? "lucide:loader-2" : "lucide:check"} width={18} className={submitting ? "animate-spin" : ""} />
              {submitting ? "예약 중" : "예약하기"}
            </button>
          </form>
        )}

        {step === 4 && professor && date && time && (
          <div className="py-2 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-900 text-white">
              <Icon icon="lucide:check" width={28} />
            </div>
            <h2 className="mb-3 text-lg font-bold tracking-tight">예약이 완료되었습니다</h2>
            <div className="mb-6 rounded-lg bg-neutral-100 p-4 text-sm">
              <div className="font-semibold">{professor.name}</div>
              <div className="mt-1 text-neutral-600">{fmtDate(date)}</div>
              <div className="text-base font-semibold">
                {time} ~ {addMinutes(time, professor.slotMinutes)}
              </div>
              <div className="mt-1 text-neutral-600">
                {name} ({studentId})
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={reset} className={`${btnSecondary} flex-1`}>
                <Icon icon="lucide:plus" width={16} />
                새로 예약
              </button>
              <Link href="/my" className={`${btnPrimary} flex-1`}>
                <Icon icon="lucide:list" width={16} />
                내 예약 보기
              </Link>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
