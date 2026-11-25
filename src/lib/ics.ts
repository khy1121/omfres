import { kstInstant } from "./schedule/rules";

// 예약 한 건을 iCalendar(.ics, RFC 5545) 파일로 만든다 — 휴대폰·Google·Outlook 캘린더에 추가용.
// 시각은 UTC(Z)로 적어 기기 시간대와 관계없이 같은 순간을 가리키게 한다.

export type IcsBooking = {
  id: string;
  date: string;
  time: string;
  endTime: string;
  scheduleTitle: string;
  courseTitle: string;
  instructorName: string;
  mode: "offline" | "online";
  location: string;
  meetingUrl: string;
};

const CRLF = "\r\n";

/** 20261202T013000Z */
function utcStamp(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/** TEXT 값 이스케이프: 역슬래시, 세미콜론, 쉼표, 줄바꿈 */
export function escapeText(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** 한 줄이 75바이트(UTF-8)를 넘으면 접는다. 이어지는 줄은 공백 하나로 시작 (멀티바이트 문자를 쪼개지 않음) */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // 이어지는 줄은 앞의 공백 1바이트 포함 75
    if (bytes + n > limit) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join(CRLF + " ");
}

export function bookingToIcs(b: IcsBooking, now = Date.now()): string {
  const start = kstInstant(b.date, b.time);
  const end = kstInstant(b.date, b.endTime);
  const where = b.mode === "online" ? b.meetingUrl || (b.location ? `온라인 · ${b.location}` : "온라인") : b.location;
  const description = [
    `${b.instructorName ? `${b.instructorName} 교수 · ` : ""}${b.courseTitle}`,
    b.scheduleTitle,
    b.mode === "online" && b.meetingUrl ? `온라인 상담 링크: ${b.meetingUrl}` : "",
    b.mode === "online" && b.location ? `안내: ${b.location}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//consultation-booking//KO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${b.id}@consultation-booking`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${utcStamp(start)}`,
    `DTEND:${utcStamp(end)}`,
    `SUMMARY:${escapeText(`상담: ${b.scheduleTitle}${b.courseTitle ? ` (${b.courseTitle})` : ""}`)}`,
    where ? `LOCATION:${escapeText(where)}` : "",
    `DESCRIPTION:${escapeText(description)}`,
    b.mode === "online" && /^https?:\/\//.test(b.meetingUrl) ? `URL:${b.meetingUrl}` : "",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(`내일 상담: ${b.scheduleTitle}`)}`,
    "TRIGGER:-P1D",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.map(foldLine).join(CRLF) + CRLF;
}

/** 내려받을 파일 이름: 상담_2026-12-02_1030.ics */
export function icsFilename(b: Pick<IcsBooking, "date" | "time">): string {
  return `상담_${b.date}_${b.time.replace(":", "")}.ics`;
}
