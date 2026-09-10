import { findProfessor, Professor } from "./config";
import { addMinutes, WEEKDAYS } from "./format";
import type { Reservation } from "./store";

/** 엑셀에서 바로 열리는 CSV (UTF-8 BOM 포함) */
export function reservationsToCsv(profs: Professor[], rows: Reservation[]): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = ["교수님", "날짜", "요일", "시작", "종료", "이름", "예약일시"];
  const lines = rows.map((r) => {
    const prof = findProfessor(profs, r.professorId);
    const [y, m, d] = r.date.split("-").map(Number);
    const w = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
    return [
      prof?.name ?? r.professorId,
      r.date,
      w,
      r.time,
      prof ? addMinutes(r.time, prof.slotMinutes) : "",
      r.name,
      new Date(r.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
    ]
      .map(esc)
      .join(",");
  });
  return "﻿" + [header.map(esc).join(","), ...lines].join("\r\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
