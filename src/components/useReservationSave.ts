"use client";

import { useRef, useState } from "react";
import type { Reservation } from "@/lib/store";

type Attempt = {
  url: string;
  method: "POST" | "PATCH";
  body: object;
  lookupUrl: string;
  expected: Pick<Reservation, "professorId" | "name" | "date" | "time"> & { id?: string };
};

/** 통신 실패 시 재전송을 막고, 읽기로 저장 결과를 확인한다. */
export function useReservationSave(onSaved: (r: Reservation) => void | Promise<void>, onBlockedChange?: (blocked: boolean) => void, onConflict?: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Attempt | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const lock = useRef(false);

  const save = async (attempt: Attempt) => {
    if (lock.current || pending) return;
    lock.current = true;
    onBlockedChange?.(true);
    setBusy(true);
    setError(null);
    setCanRetry(false);
    let saved: Reservation | undefined;
    let uncertain = false;
    let conflict = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(attempt.url, {
        method: attempt.method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(attempt.body), signal: controller.signal,
      });
      if (response.status >= 500) throw new Error("unknown result");
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "저장하지 못했습니다.");
        setRefreshVersion((v) => v + 1);
        conflict = response.status === 409;
      } else if (data.reservation?.id) {
        saved = data.reservation;
      } else {
        throw new Error("missing result");
      }
    } catch {
      uncertain = true;
      setPending(attempt);
      setError("처리 결과를 확인하지 못했습니다. 다시 저장하기 전에 예약 상태를 확인해주세요.");
    } finally {
      clearTimeout(timeout);
      lock.current = false;
      setBusy(false);
      onBlockedChange?.(uncertain);
    }
    if (conflict) onConflict?.();
    if (saved) await onSaved(saved);
  };

  const check = async () => {
    if (!pending || lock.current) return;
    lock.current = true;
    setBusy(true);
    setCanRetry(false);
    let saved: Reservation | undefined;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(pending.lookupUrl, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("lookup failed");
      const data = await response.json();
      if (!Array.isArray(data.reservations)) throw new Error("invalid result");
      const e = pending.expected;
      saved = data.reservations.find((r: Reservation) =>
        (!e.id || r.id === e.id) && r.professorId === e.professorId && r.name === e.name && r.date === e.date && r.time === e.time);
      if (saved) {
        setPending(null);
        setError(null);
        onBlockedChange?.(false);
      } else {
        // 조회에 없어도 지연 중인 쓰기가 완료될 수 있으므로 자동 재전송하지 않는다.
        setCanRetry(true);
        setError("현재 예약 내역에서 요청한 일정을 찾지 못했습니다. 기존 요청이 늦게 반영될 수 있습니다. 상태를 다시 확인하거나, 이를 확인한 뒤 입력을 유지하고 다시 시도할 수 있습니다.");
      }
    } catch {
      setError("예약 상태를 불러오지 못했습니다. 연결을 확인한 뒤 다시 확인해주세요.");
    } finally {
      clearTimeout(timeout);
      lock.current = false;
      setBusy(false);
    }
    if (saved) await onSaved(saved);
  };

  const allowRetry = () => {
    if (!canRetry || lock.current) return;
    setPending(null);
    setCanRetry(false);
    setError(null);
    setRefreshVersion((v) => v + 1);
    onBlockedChange?.(false);
  };

  return { busy, error, pending: !!pending, canRetry, refreshVersion, save, check, allowRetry };
}
