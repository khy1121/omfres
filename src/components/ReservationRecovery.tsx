"use client";

import { btnSecondary } from "./ui";
import type { useReservationSave } from "./useReservationSave";

export default function ReservationRecovery({ mutation }: { mutation: ReturnType<typeof useReservationSave> }) {
  if (!mutation.pending) return null;
  return (
    <div className="my-3 space-y-2">
      <button type="button" disabled={mutation.busy} onClick={mutation.check} className={`${btnSecondary} w-full`}>
        예약 상태 확인
      </button>
      {mutation.canRetry && <button type="button" disabled={mutation.busy} onClick={mutation.allowRetry} className={`${btnSecondary} w-full`}>
        입력 유지하고 다시 시도
      </button>}
    </div>
  );
}
