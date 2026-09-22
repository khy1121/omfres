"use client";

import { Icon } from "@iconify/react";
import { useState } from "react";
import ProfessorPicker from "./ProfessorPicker";
import SlotPicker from "./SlotPicker";
import { btnPrimary, ErrorBox, Field, inputCls, StepHeader } from "./ui";
import { useProfessor, useProfessors } from "./ProfessorsProvider";
import { Professor } from "@/lib/config";
import { fmtDate, fmtRange } from "@/lib/format";
import type { Reservation } from "@/lib/store";
import { useReservationSave } from "./useReservationSave";
import { canChangeReservation } from "@/lib/reservation-time";
import ReservationRecovery from "./ReservationRecovery";

export type EditorMode = { kind: "create" } | { kind: "move"; r: Reservation };

type Props = {
  mode: EditorMode;
  today: string;
  now: number;
  onCancel: () => void;
  /** 성공 시 호출. 목록 새로고침은 호출자가 담당 */
  onDone: (message: string) => Promise<void>;
};

/** 관리자용 예약 추가 / 이동 화면 */
export default function AdminEditor({ mode, today, now, onCancel, onDone }: Props) {
  const [name, setName] = useState("");
  const [professor, setProfessor] = useState<Professor | null>(null);
  const [stage, setStage] = useState<"name" | "professor" | "slot">(mode.kind === "create" ? "name" : "slot");
  const mutation = useReservationSave(async (r) => {
    await onDone(`${r.name} 학생의 ${fmtDate(r.date)} ${r.time} 예약을 저장했습니다.`);
  });

  const PROFESSORS = useProfessors();
  const moveProfFound = useProfessor(mode.kind === "move" ? mode.r.professorId : "");
  const moveProf = mode.kind === "move" ? moveProfFound : null;

  const submitCreate = async (date: string, time: string) => {
    if (!professor) return;
    const expected = { professorId: professor.id, date, time, name: name.trim() };
    await mutation.save({ url: "/api/admin/reservations", method: "POST", body: expected,
      lookupUrl: "/api/admin/reservations", expected });
  };

  const submitMove = async (date: string, time: string) => {
    if (mode.kind !== "move") return;
    await mutation.save({ url: `/api/admin/reservations/${mode.r.id}`, method: "PATCH", body: { date, time },
      lookupUrl: "/api/admin/reservations", expected: { ...mode.r, date, time } });
  };

  const recovery = <ReservationRecovery mutation={mutation} />;
  const pickerProps = { busy: mutation.busy, blocked: mutation.pending, error: mutation.error, refreshVersion: mutation.refreshVersion };

  // ── 이동 ──
  if (mode.kind === "move") {
    if (!moveProf) return <ErrorBox>교수님 정보를 찾을 수 없습니다.</ErrorBox>;
    return (
      <>
        <div className="mb-4 rounded-lg bg-neutral-100 p-3 text-sm">
          <div className="flex items-center gap-1.5 font-semibold">
            <Icon icon="lucide:move" width={16} />
            {mode.r.name} 학생 예약 옮기기
          </div>
          <div className="mt-1 text-neutral-600">
            현재: {moveProf.name} · {fmtDate(mode.r.date)} {fmtRange(PROFESSORS, mode.r.professorId, mode.r.time)}
          </div>
        </div>
        <SlotPicker
          today={today}
          professor={moveProf}
          current={{ date: mode.r.date, time: mode.r.time }}
          onBack={onCancel}
          onPick={submitMove}
          {...pickerProps}
          blocked={mutation.pending || !canChangeReservation(mode.r, now)}
          confirmLabel="이 일정으로 변경"
        />
        {recovery}
        {!canChangeReservation(mode.r, now) && <ErrorBox>상담 시작 시간이 지나 이동할 수 없습니다.</ErrorBox>}
        {!mutation.pending && !canChangeReservation(mode.r, now) && <button type="button" onClick={onCancel} className={`${btnPrimary} mt-3`}>목록으로 돌아가기</button>}
      </>
    );
  }

  // ── 추가 ──
  if (stage === "name") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setStage("professor");
        }}
      >
        <StepHeader title="예약 추가 · 학생 이름" onBack={onCancel} />
        <Field label="이름" icon="lucide:user">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="홍길동"
            required
            minLength={2}
            maxLength={20}
            className={inputCls}
            autoFocus
          />
        </Field>
        <button type="submit" className={`${btnPrimary} w-full`}>
          다음
          <Icon icon="lucide:arrow-right" width={16} />
        </button>
      </form>
    );
  }

  if (stage === "professor") {
    return (
      <>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-neutral-600">학생: <span className="font-semibold text-neutral-900">{name.trim()}</span></p>
          <button type="button" onClick={() => setStage("name")} className="text-sm text-neutral-600 hover:underline">
            이름 변경
          </button>
        </div>
        <ProfessorPicker
          onPick={(p) => {
            setProfessor(p);
            setStage("slot");
          }}
        />
      </>
    );
  }

  return (
    <>
      <p className="mb-3 text-sm text-neutral-600">
        학생: <span className="font-semibold text-neutral-900">{name.trim()}</span>
      </p>
      {professor && <SlotPicker today={today} professor={professor} onBack={() => setStage("professor")} onPick={submitCreate} {...pickerProps} confirmLabel="예약 확정" />}
      {recovery}
    </>
  );
}
