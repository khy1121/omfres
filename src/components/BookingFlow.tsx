"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";
import { useState } from "react";
import SlotPicker from "./SlotPicker";
import { btnPrimary, btnSecondary, Card, ErrorBox, Field, inputCls, StepHeader } from "./ui";
import { CONFIG } from "@/lib/config";
import { addMinutes, fmtDate } from "@/lib/format";

type Step = 1 | 2 | 3;

export default function BookingFlow({ today }: { today: string }) {
  const [step, setStep] = useState<Step>(1);
  const [pickerKey, setPickerKey] = useState(0);
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
        body: JSON.stringify({ date, time, studentId, name }),
      });
      const j = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          // 슬롯 선택 화면으로 돌아가 다시 고르게 함
          setConflict(j.error);
          setPickerKey((k) => k + 1);
          setStep(1);
        } else {
          setError(j.error ?? "예약에 실패했습니다.");
        }
        return;
      }
      setStep(3);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setStep(1);
    setPickerKey((k) => k + 1);
    setDate(null);
    setTime(null);
    setStudentId("");
    setName("");
    setError(null);
    setConflict(null);
  };

  const steps = [
    { label: "일정 선택", icon: "lucide:calendar-days" },
    { label: "정보 입력", icon: "lucide:user" },
    { label: "완료", icon: "lucide:check" },
  ];

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
              {i < steps.length - 1 && <div className={`mx-3 h-px flex-1 ${done ? "bg-neutral-900" : "bg-neutral-200"}`} />}
            </li>
          );
        })}
      </ol>

      <Card>
        {step === 1 && (
          <SlotPicker
            key={pickerKey}
            today={today}
            error={conflict}
            onPick={(d, t) => {
              setDate(d);
              setTime(t);
              setConflict(null);
              setStep(2);
            }}
          />
        )}

        {step === 2 && date && time && (
          <form onSubmit={submit}>
            <StepHeader title="정보를 입력하세요" onBack={() => setStep(1)} />
            <div className="mb-5 flex items-center gap-3 rounded-lg bg-neutral-100 p-3 text-sm">
              <Icon icon="lucide:calendar-check" width={22} className="shrink-0" />
              <div>
                <div className="text-neutral-600">{fmtDate(date)}</div>
                <div className="font-semibold">
                  {time} ~ {addMinutes(time, CONFIG.slotMinutes)}
                </div>
              </div>
            </div>
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
              {submitting ? (
                <Icon icon="lucide:loader-2" width={18} className="animate-spin" />
              ) : (
                <Icon icon="lucide:check" width={18} />
              )}
              {submitting ? "예약 중" : "예약하기"}
            </button>
          </form>
        )}

        {step === 3 && date && time && (
          <div className="py-2 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-900 text-white">
              <Icon icon="lucide:check" width={28} />
            </div>
            <h2 className="mb-3 text-lg font-bold tracking-tight">예약이 완료되었습니다</h2>
            <div className="mb-6 rounded-lg bg-neutral-100 p-4 text-sm">
              <div className="text-neutral-600">{fmtDate(date)}</div>
              <div className="text-base font-semibold">
                {time} ~ {addMinutes(time, CONFIG.slotMinutes)}
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
