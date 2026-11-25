import "./setup";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { bookingToIcs, escapeText, foldLine, icsFilename, type IcsBooking } from "../src/lib/ics";
import AddToCalendarButton from "../src/components/schedules/AddToCalendarButton";

afterEach(cleanup);

const booking: IcsBooking = {
  id: "bk123",
  date: "2026-12-02",
  time: "10:30",
  endTime: "11:00",
  scheduleTitle: "기말 프로젝트 면담",
  courseTitle: "자료구조 (01분반)",
  instructorName: "김교수",
  mode: "offline",
  location: "연구관 709호",
  meetingUrl: "",
};

const unfold = (ics: string) => ics.replace(/\r\n /g, "");

test("event times are written in UTC from Korean local time", () => {
  const ics = unfold(bookingToIcs(booking, Date.parse("2026-11-25T00:00:00Z")));
  assert.match(ics, /DTSTART:20261202T013000Z\r\n/, "10:30 KST = 01:30 UTC");
  assert.match(ics, /DTEND:20261202T020000Z\r\n/);
  assert.match(ics, /DTSTAMP:20261125T000000Z\r\n/);
  assert.match(ics, /UID:bk123@consultation-booking\r\n/);
});

test("the file is a valid calendar with summary, location, description and a day-before alarm", () => {
  const raw = bookingToIcs(booking);
  assert.ok(raw.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n"));
  assert.ok(raw.endsWith("END:VEVENT\r\nEND:VCALENDAR\r\n"));
  assert.ok(!/[^\r]\n/.test(raw), "every line ends with CRLF");
  const ics = unfold(raw);
  assert.match(ics, /SUMMARY:상담: 기말 프로젝트 면담 \(자료구조 \(01분반\)\)\r\n/);
  assert.match(ics, /LOCATION:연구관 709호\r\n/);
  assert.match(ics, /DESCRIPTION:김교수 교수 · 자료구조 \(01분반\)\\n기말 프로젝트 면담\r\n/);
  assert.match(ics, /BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:내일 상담: 기말 프로젝트 면담\r\nTRIGGER:-P1D\r\nEND:VALARM/);
});

test("online consultations carry the meeting link", () => {
  const ics = unfold(bookingToIcs({ ...booking, mode: "online", location: "대기실 입장 후 대기", meetingUrl: "https://zoom.us/j/123?pwd=a,b" }));
  assert.match(ics, /LOCATION:https:\/\/zoom.us\/j\/123\?pwd=a\\,b\r\n/);
  assert.match(ics, /URL:https:\/\/zoom.us\/j\/123\?pwd=a,b\r\n/);
  assert.match(ics, /온라인 상담 링크: https:\/\/zoom.us/);
  assert.match(ics, /안내: 대기실 입장 후 대기/);
});

test("text is escaped and long lines are folded at 75 bytes without splitting characters", () => {
  assert.equal(escapeText("a;b,c\\d\ne"), "a\\;b\\,c\\\\d\\ne");
  const long = "SUMMARY:" + "상담".repeat(40);
  const folded = foldLine(long);
  const enc = new TextEncoder();
  for (const part of folded.split("\r\n")) assert.ok(enc.encode(part).length <= 75, `line too long: ${enc.encode(part).length}`);
  assert.equal(folded.replace(/\r\n /g, ""), long, "unfolding restores the original");
  assert.equal(foldLine("SHORT:ok"), "SHORT:ok");
});

test("file name uses the date and start time", () => {
  assert.equal(icsFilename(booking), "상담_2026-12-02_1030.ics");
});

test("the button downloads the booking as a calendar file", async () => {
  const created: Blob[] = [];
  const clicked: string[] = [];
  const origCreate = URL.createObjectURL;
  const origRevoke = URL.revokeObjectURL;
  const origClick = HTMLElement.prototype.click;
  URL.createObjectURL = ((b: Blob) => { created.push(b); return "blob:test"; }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = () => {};
  HTMLElement.prototype.click = function (this: HTMLElement) { clicked.push((this as HTMLAnchorElement).download); };
  try {
    render(<AddToCalendarButton booking={booking} className="btn" />);
    fireEvent.click(screen.getByRole("button", { name: "내 캘린더에 추가" }));
    assert.equal(created.length, 1);
    assert.equal(created[0].type, "text/calendar;charset=utf-8");
    assert.match(await created[0].text(), /BEGIN:VCALENDAR/);
    assert.deepEqual(clicked, ["상담_2026-12-02_1030.ics"]);
  } finally {
    URL.createObjectURL = origCreate;
    URL.revokeObjectURL = origRevoke;
    HTMLElement.prototype.click = origClick;
  }
});
