import { generateTimeSlots, type Professor } from "./config";
import { canChangeReservation, reservationStatus } from "./reservation-time";
import type { Reservation } from "./store";

export function scheduleImpact(before: Professor, after: Professor, rows: Reservation[], now: number) {
  const durationChanged = before.slotMinutes !== after.slotMinutes;
  return rows.filter((r) => r.professorId === before.id && (canChangeReservation(r, now) ||
    (durationChanged && (reservationStatus(r, before.slotMinutes, now) === "ongoing" || reservationStatus(r, after.slotMinutes, now) === "ongoing")))).flatMap((r) => {
    const reasons: string[] = [];
    if (durationChanged) reasons.push(`상담 시간 ${before.slotMinutes}분 → ${after.slotMinutes}분`);
    if (after.excludeDates?.includes(r.date) || (after.onlyDates && !after.onlyDates.includes(r.date)) ||
        !generateTimeSlots(after, r.date).includes(r.time)) reasons.push("새 운영 일정 밖의 예약");
    return reasons.length ? [{ reservation: r, reasons }] : [];
  });
}
