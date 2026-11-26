import "./setup";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import BookingPicker from "../src/components/schedules/BookingPicker";
import NoFitHelp, { mailtoHref } from "../src/components/schedules/NoFitHelp";
import type { SlotConfig } from "../src/lib/schedule/rules";

afterEach(cleanup);

const cfg: SlotConfig = {
  slotMinutes: 30,
  ruleType: "recurring",
  recurring: { from: "2099-09-23", to: "2099-10-31", windows: [{ days: [0, 1, 2, 3, 4, 5, 6], start: "10:00", end: "11:00" }], excludeDates: [] },
  manualSlots: [],
};

test("목록 보기는 남은 날짜만 보여주고, 고르면 그날 시간이 열린다", async () => {
  globalThis.fetch = (async (url: string) => {
    if (String(url).includes("/availability"))
      return Response.json({ days: { "2099-09-25": 2, "2099-09-24": 0, "2099-10-02": 1 }, next: { date: "2099-09-25", time: "10:00" } });
    return Response.json({
      slots: [{ time: "10:00", end: "10:30", available: true, reason: null }, { time: "10:30", end: "11:00", available: true, reason: null }],
      quota: { used: 0, max: 1 },
    });
  }) as typeof fetch;
  render(<BookingPicker courseId="c" scheduleId="s" cfg={cfg} today="2099-09-23" onDone={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: "목록" }));
  const list = await screen.findByRole("list", { name: "예약 가능한 날짜" });
  const rows = list.querySelectorAll("button");
  assert.deepEqual([...rows].map((b) => b.textContent), ["2099년 9월 25일 (금)2개 남음", "2099년 10월 2일 (금)1개 남음"]);
  fireEvent.click(rows[1]);
  assert.ok(await screen.findByRole("heading", { name: /2099년 10월 2일 \(금\) 상담 시간/ }));
  assert.equal(rows[1].getAttribute("aria-pressed"), "true");
  fireEvent.click(screen.getByRole("button", { name: "달력" }));
  assert.ok(screen.getByRole("group", { name: "2099년 10월" }), "달력은 고른 날짜의 달을 보여준다");
});

test("맞는 시간이 없을 때 다른 일정과 교수 메일을 안내한다", () => {
  const p = { courseId: "c", courseTitle: "운영체제", scheduleTitle: "기말 면담", instructorName: "김교수", instructorEmail: "prof@hansung.ac.kr", others: [{ id: "s2", title: "프로젝트 면담" }] };
  render(<NoFitHelp {...p} />);
  assert.ok(screen.getByRole("heading", { name: "맞는 시간이 없나요?" }));
  assert.equal(screen.getByRole("link", { name: /프로젝트 면담/ }).getAttribute("href"), "/courses/c/schedules/s2");
  const mail = screen.getByRole("link", { name: "김교수 교수님께 메일 보내기" }).getAttribute("href")!;
  assert.ok(mail.startsWith("mailto:prof@hansung.ac.kr?subject="));
  assert.equal(decodeURIComponent(mail.split("subject=")[1]), "[운영체제] 기말 면담 상담 시간 문의");
  cleanup();
  const { container } = render(<NoFitHelp {...p} instructorEmail={null} others={[]} />);
  assert.equal(container.innerHTML, "", "안내할 것이 없으면 숨긴다");
  assert.equal(mailtoHref({ ...p, instructorEmail: null }), null);
});
