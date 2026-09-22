type Schedule = { date: string; time: string };

export function reservationStart(r: Schedule): number {
  return Date.parse(`${r.date}T${r.time}:00+09:00`);
}

/** 변경·학생 취소는 상담 시작 전까지 허용한다. 관리자 삭제는 제외한다. */
export function canChangeReservation(r: Schedule, now = Date.now()): boolean {
  return now < reservationStart(r);
}

export function reservationStatus(r: Schedule, minutes: number | undefined, now = Date.now()) {
  const start = reservationStart(r);
  if (now < start) return "upcoming";
  if (minutes === undefined) return "unknown";
  return now < start + minutes * 60_000 ? "ongoing" : "elapsed";
}

export const reservationStatusLabel = {
  upcoming: "예정", ongoing: "상담 시간 중", elapsed: "상담 시간 경과", unknown: "시작 시간 경과",
};
