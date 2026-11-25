import { kstInstant } from "./rules";

// 예약 진행 상태 (서버·브라우저 공용). 한국 시간 기준으로 계산하며 실제 참석 여부를 뜻하지 않는다.

export type BookingPhase = "upcoming" | "ongoing" | "elapsed" | "cancelled";

export function bookingPhase(b: { date: string; time: string; slotMinutes: number; status: string }, now: number): BookingPhase {
  if (b.status === "cancelled") return "cancelled";
  const start = kstInstant(b.date, b.time);
  if (now < start) return "upcoming";
  return now < start + b.slotMinutes * 60_000 ? "ongoing" : "elapsed";
}
