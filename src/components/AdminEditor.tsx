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

export type EditorMode = { kind: "create" } | { kind: "move"; r: Reservation };

type Props = {
  mode: EditorMode;
  today: string;
  onCancel: () => void;
  /** 성공 시 호출. 목록 새로고침은 호출자가 담당 */
  onDone: (message: string) => Promise<void>;
};

/** 관리자용 예약 추가 / 이동 화면 */
export default function AdminEditor({ mode, today, onCancel, onDone }: Props) {
  const [name, setName] = useState("");
  const [professor, setProfessor] = useState<Professor | null>(null);
  const [stage, setStage] = useState<"name" | "professor" | "slot">(mode.kind === "create" ? "name" : "slot");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const PROFESSORS = useProfessors();
  const moveProfFound = useProfessor(mode.kind === "move" ? mode.r.professorId : "");
  const moveProf = mode.kind === "move" ? moveProfFound : null;

  const submitCreate = async (date: string, time: string) => {
    if (!professor) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ professorId: professor.id, date, time, name: name.trim() }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      await onDone(`${name.trim()} 학생의 ${professor.name} ${fmtDate(date)} ${time} 예약을 추가했습니다.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "추가에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const submitMove = async (date: string, time: string) => {
    if (mode.kind !== "move") return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reservations/${mode.r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, time }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      await onDone(`${mode.r.name} 학생의 예약을 ${fmtDate(date)} ${time}으로 옮겼습니다.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "이동에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  if (busy) {
    return (
      <p className="flex items-center justify-center gap-2 py-16 text-sm text-neutral-500">
        <Icon icon="lucide:loader-2" width={18} className="animate-spin" />
        저장 중
      </p>
    );
  }

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
          error={error}
        />
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
      {professor && <SlotPicker today={today} professor={professor} onBack={() => setStage("professor")} onPick={submitCreate} error={error} />}
    </>
  );
}
