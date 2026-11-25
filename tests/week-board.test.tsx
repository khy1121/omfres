import "./setup";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import WeekBoard from "../src/components/schedules/WeekBoard";
import type { SlotConfig } from "../src/lib/schedule/rules";

afterEach(cleanup);

const cfg: SlotConfig = {
  slotMinutes: 30,
  ruleType: "recurring",
  recurring: { from: "2030-03-01", to: "2030-03-31", windows: [{ days: [1], start: "10:00", end: "11:00" }], excludeDates: [] },
  manualSlots: [],
};
const b = (id: string, scheduleId: string, date: string, time: string) => ({
  id, scheduleId, date, time, endTime: "—", studentName: "홍길동", studentNo: "2071234", courseTitle: "운영체제", scheduleTitle: "기말 면담",
});

test("이번 주 예약과 다른 수업 상담을 보여주고 주를 넘길 수 있다", () => {
  render(<WeekBoard cfg={cfg} scheduleId="s" today="2030-03-06" bookings={[b("1", "s", "2030-03-04", "10:00"), b("2", "o", "2030-03-05", "09:00"), b("3", "s", "2030-03-11", "10:30")]} />);
  assert.ok(screen.getByText(/3월 4일 \(월\) ~ 3월 10일 \(일\) · 이 일정 예약 1건/));
  assert.ok(screen.getByText("홍길동"));
  assert.ok(screen.getByText("운영체제"));
  assert.equal(screen.getAllByText("상담 2칸").length, 1);
  assert.equal(screen.queryByRole("button", { name: "이번 주" }), null);

  fireEvent.click(screen.getByRole("button", { name: "다음 주" }));
  assert.ok(screen.getByText(/3월 11일 \(월\) ~ 3월 17일 \(일\) · 이 일정 예약 1건/));
  assert.equal(screen.queryByText("운영체제"), null);
  fireEvent.click(screen.getByRole("button", { name: "이번 주" }));
  assert.ok(screen.getByText(/3월 4일 \(월\) ~ 3월 10일/));
});
