import { hasSlot, kstInstant, type ScheduleInput } from "./rules";

type BookingLike = { id: string; date: string; time: string; status: string; studentId: string };

export type ImpactReason = "no_slot" | "audience";

/**
 * 일정 수정 시 영향을 받는 예정 예약 (자동 취소하지 않고 교수자에게 보여준다).
 * - no_slot: 새 규칙에 그 시각의 상담이 없음
 * - audience: 새 공개 대상에서 빠진 학생
 */
export function scheduleImpact<T extends BookingLike>(next: ScheduleInput, bookings: T[], now: number): (T & { reason: ImpactReason })[] {
  const out: (T & { reason: ImpactReason })[] = [];
  for (const b of bookings) {
    if (b.status !== "booked" || kstInstant(b.date, b.time) <= now) continue;
    if (!hasSlot(next, b.date, b.time)) out.push({ ...b, reason: "no_slot" });
    else if (next.audience === "selected" && !next.audienceIds.includes(b.studentId)) out.push({ ...b, reason: "audience" });
  }
  return out;
}
