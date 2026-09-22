"use client";

import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import SlotPicker from "./SlotPicker";
import { btnDanger, btnPrimary, btnSecondary, Card, ErrorBox, Field, inputCls, StepHeader } from "./ui";
import { useProfessors, useReservationLookup } from "./ProfessorsProvider";
import { findProfessor } from "@/lib/config";
import { fmtDate, fmtRange, profName } from "@/lib/format";
import type { Reservation } from "@/lib/store";
import { canChangeReservation, reservationStatus, reservationStatusLabel } from "@/lib/reservation-time";
import { useNow } from "./useNow";
import { useReservationSave } from "./useReservationSave";
import ReservationRecovery from "./ReservationRecovery";

type View = { kind: "lookup" } | { kind: "loading" } | { kind: "list" } | { kind: "edit"; r: Reservation } | { kind: "cancel"; r: Reservation };

export default function MyReservations({ today, initialNow }: { today: string; initialNow: number }) {
  const PROFESSORS = useProfessors();
  const now = useNow(initialNow);
  const lookupSession = useReservationLookup();
  const [initialName] = useState(lookupSession.name);
  const [name, setName] = useState(initialName);
  const [view, setView] = useState<View>({ kind: initialName ? "loading" : "lookup" });
  const [rows, setRows] = useState<Reservation[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!initialName) return;
    const controller = new AbortController();
    let active = true;
    void (async () => {
      try {
        const response = await fetch(`/api/reservations?name=${encodeURIComponent(initialName)}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "조회에 실패했습니다.");
        if (active) { setRows(data.reservations ?? []); setView({ kind: "list" }); }
      } catch (err) {
        if (active) { setError(err instanceof Error ? err.message : "조회에 실패했습니다."); setView({ kind: "lookup" }); }
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [initialName]);
  const mutation = useReservationSave((updated) => {
    setRows((rows) => rows.map((r) => r.id === updated.id ? updated : r));
    setNotice("예약이 변경되었습니다.");
    setView({ kind: "list" });
  });

  const query = () => `name=${encodeURIComponent(name)}`;

  const load = async () => {
    const res = await fetch(`/api/reservations?${query()}`, { cache: "no-store" });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error);
    setRows(j.reservations ?? []);
  };

  const lookup = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await load();
      setView({ kind: "list" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "조회에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const move = async (r: Reservation, date: string, time: string) => {
    await mutation.save({
      url: `/api/reservations/${r.id}`, method: "PATCH", body: { name, date, time },
      lookupUrl: `/api/reservations?${query()}`, expected: { ...r, date, time },
    });
  };

  const cancel = async (r: Reservation) => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/reservations/${r.id}?${query()}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      await load();
      setNotice("예약이 취소되었습니다.");
      setView({ kind: "list" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "취소에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const status = (r: Reservation) => reservationStatus(r, findProfessor(PROFESSORS, r.professorId)?.slotMinutes, now);
  const isPast = (r: Reservation) => ["elapsed", "unknown"].includes(status(r));
  const upcoming = rows.filter((r) => !isPast(r));
  const past = rows.filter(isPast);

  return (
    <div className="mx-auto w-full max-w-md">
      <Card>
        {view.kind === "loading" && <p role="status">예약을 확인하는 중입니다.</p>}
        {view.kind === "lookup" && (
          <form onSubmit={lookup}>
            <StepHeader title="예약 조회" />
            <p className="mb-5 text-sm text-neutral-600">예약 시 입력한 이름으로 조회합니다.</p>
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
            <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>
              <Icon icon={busy ? "lucide:loader-2" : "lucide:search"} width={18} className={busy ? "animate-spin" : ""} />
              조회하기
            </button>
          </form>
        )}

        {view.kind === "list" && (
          <>
            <StepHeader
              title="내 예약"
              onBack={() => {
                setView({ kind: "lookup" });
                setNotice(null);
                setError(null);
              }}
            />
            <p className="mb-4 text-sm text-neutral-600">
              {name}
            </p>
            {notice && (
              <div role="status" className="mb-4 flex items-center gap-2 rounded-lg bg-neutral-900 p-3 text-sm text-white">
                <Icon icon="lucide:check-circle" width={18} />
                {notice}
              </div>
            )}
            {error && <ErrorBox>{error}</ErrorBox>}

            {rows.length === 0 && (
              <div className="py-10 text-center text-sm text-neutral-500">
                <Icon icon="lucide:calendar-x" width={36} className="mx-auto mb-2 text-neutral-300" />
                예약 내역이 없습니다.
                <div className="mt-4 flex justify-center gap-2">
                  <button type="button" onClick={() => setView({ kind: "lookup" })} className={btnSecondary}>이름 다시 확인</button>
                  <Link href="/" className={btnPrimary}>새 예약하기</Link>
                </div>
              </div>
            )}

            {upcoming.length > 0 && (
              <ul className="space-y-3">
                {upcoming.map((r) => (
                  <li key={r.id} className="rounded-xl border border-neutral-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="mb-0.5 flex items-center gap-1 text-sm font-medium">
                          <Icon icon="lucide:graduation-cap" width={14} />
                          {profName(PROFESSORS, r.professorId)}
                        </div>
                        <div className="text-sm text-neutral-600">{fmtDate(r.date)}</div>
                        <div className="text-lg font-semibold tracking-tight">
                          {fmtRange(PROFESSORS, r.professorId, r.time)}
                        </div>
                        <p className="mt-1 text-xs text-neutral-500">{reservationStatusLabel[status(r)]}</p>
                        {(() => {
                          const p = findProfessor(PROFESSORS, r.professorId);
                          if (!p?.office && !p?.phone) return null;
                          return (
                            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-600">
                              {p.office && (
                                <span className="flex items-center gap-1">
                                  <Icon icon="lucide:map-pin" width={13} />
                                  {p.office}
                                </span>
                              )}
                              {p.phone && (
                                <a href={`tel:${p.phone}`} className="flex items-center gap-1 hover:underline">
                                  <Icon icon="lucide:phone" width={13} />
                                  {p.phone}
                                </a>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                      <Icon icon="lucide:calendar-check" width={22} className="shrink-0 text-neutral-400" />
                    </div>
                    {canChangeReservation(r, now) && <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          setNotice(null);
                          setView({ kind: "edit", r });
                        }}
                        className={`${btnSecondary} flex-1 py-2`}
                      >
                        <Icon icon="lucide:pencil" width={15} />
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          setNotice(null);
                          setView({ kind: "cancel", r });
                        }}
                        className={`${btnDanger} flex-1 py-2`}
                      >
                        <Icon icon="lucide:trash-2" width={15} />
                        취소
                      </button>
                    </div>}
                  </li>
                ))}
              </ul>
            )}

            {past.length > 0 && (
              <details className="mt-5">
                <summary className="cursor-pointer text-sm text-neutral-500">지난 예약 {past.length}건</summary>
                <ul className="mt-2 space-y-2">
                  {past.map((r) => (
                    <li key={r.id} className="flex justify-between rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
                      <span>
                        {profName(PROFESSORS, r.professorId)} · {fmtDate(r.date)}
                      </span>
                      <span>{r.time}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}

        {view.kind === "edit" && (
          <>
            <p className="mb-3 text-sm">예약자: {name}</p>
            {!findProfessor(PROFESSORS, view.r.professorId) ? (
              <ErrorBox>교수님 정보를 찾을 수 없어 변경할 수 없습니다.</ErrorBox>
            ) : (
              <SlotPicker
                today={today}
                professor={findProfessor(PROFESSORS, view.r.professorId)!}
                current={{ date: view.r.date, time: view.r.time }}
                onBack={() => setView({ kind: "list" })}
                onPick={(d, t) => move(view.r, d, t)}
                error={mutation.error}
                busy={mutation.busy}
                blocked={mutation.pending || !canChangeReservation(view.r, now)}
                refreshVersion={mutation.refreshVersion}
                confirmLabel="이 일정으로 변경"
              />
            )}
            {!canChangeReservation(view.r, now) && <ErrorBox>상담 시작 시간이 지나 변경할 수 없습니다.</ErrorBox>}
            <ReservationRecovery mutation={mutation} />
            {!mutation.pending && !canChangeReservation(view.r, now) && <button type="button" onClick={() => setView({ kind: "list" })} className={btnSecondary}>목록으로 돌아가기</button>}
          </>
        )}

        {view.kind === "cancel" && (
          <>
            <StepHeader title="예약을 취소할까요?" onBack={() => setView({ kind: "list" })} />
            <div className="mb-5 rounded-lg bg-neutral-100 p-4 text-sm">
              <div className="font-semibold">{profName(PROFESSORS, view.r.professorId)}</div>
              <div className="text-neutral-600">{fmtDate(view.r.date)}</div>
              <div className="text-base font-semibold">
                {fmtRange(PROFESSORS, view.r.professorId, view.r.time)}
              </div>
            </div>
            <p className="mb-5 text-sm text-neutral-600">취소한 예약은 되돌릴 수 없습니다.</p>
            {!canChangeReservation(view.r, now) && <ErrorBox>상담 시작 시간이 지나 취소할 수 없습니다.</ErrorBox>}
            {error && <ErrorBox>{error}</ErrorBox>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setView({ kind: "list" })} className={`${btnSecondary} flex-1`}>
                돌아가기
              </button>
              <button type="button" disabled={busy || !canChangeReservation(view.r, now)} onClick={() => cancel(view.r)} className={`${btnPrimary} flex-1`}>
                <Icon icon={busy ? "lucide:loader-2" : "lucide:trash-2"} width={16} className={busy ? "animate-spin" : ""} />
                예약 취소
              </button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
