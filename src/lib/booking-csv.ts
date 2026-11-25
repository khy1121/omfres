import { downloadFile } from "./download";
import { WEEKDAY_NAMES, weekday } from "./schedule/rules";

type Row = {
  courseTitle: string;
  scheduleTitle: string;
  date: string;
  time: string;
  endTime: string;
  studentName: string;
  studentNo: string | null;
  studentEmail: string | null;
  status: "booked" | "cancelled";
  mode: "offline" | "online";
  location: string;
  createdAt: string | null;
};

const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
const kst = (iso: string | null) => (iso ? new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "");

/** 엑셀에서 바로 열리는 예약 CSV (UTF-8 BOM, CRLF) */
export function bookingsToCsv(rows: Row[]): string {
  const header = ["수업", "일정", "날짜", "요일", "시작", "종료", "이름", "학번", "이메일", "상태", "방식", "장소", "예약일시"];
  const lines = rows.map((r) =>
    [
      r.courseTitle,
      r.scheduleTitle,
      r.date,
      WEEKDAY_NAMES[weekday(r.date)],
      r.time,
      r.endTime,
      r.studentName,
      r.studentNo ?? "",
      r.studentEmail ?? "",
      r.status === "booked" ? "예약" : "취소",
      r.mode === "online" ? "온라인" : "대면",
      r.location,
      kst(r.createdAt),
    ]
      .map(esc)
      .join(","),
  );
  return "﻿" + [header.map(esc).join(","), ...lines].join("\r\n");
}

export function downloadCsv(filename: string, csv: string) {
  downloadFile(filename, csv, "text/csv;charset=utf-8;");
}
