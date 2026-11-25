import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { fireEvent, render, screen } from "@testing-library/react";
import Calendar from "../src/components/Calendar";
import SlotPicker from "../src/components/SlotPicker";
import { professor } from "./fixtures";

test("calendar announces date state, moves keyboard focus across months, and stops at the final month", () => {
  const selected: string[] = [];
  render(<Calendar today="2099-09-23" selected={null} isSelectable={(d) => d !== "2099-10-01"} unavailableReason={() => "상담 제외일"} onSelect={(d) => selected.push(d)} />);
  assert.equal(screen.getByRole("button", { name: /2099년 9월 23일/ }).getAttribute("aria-current"), "date");
  const sept30 = screen.getByRole("button", { name: /2099년 9월 30일/ });
  fireEvent.keyDown(sept30, { key: "ArrowRight" });
  const excluded = screen.getByRole("button", { name: /2099년 10월 1일.*상담 제외일/ });
  assert.equal(document.activeElement, excluded);
  assert.equal(excluded.getAttribute("aria-disabled"), "true");
  fireEvent.click(excluded);
  assert.deepEqual(selected, []);
  fireEvent.keyDown(excluded, { key: "ArrowRight" });
  assert.equal(document.activeElement, screen.getByRole("button", { name: /2099년 10월 2일/ }));
  fireEvent.click(screen.getByRole("button", { name: "다음 달" }));
  assert.equal((screen.getByRole("button", { name: "다음 달" }) as HTMLButtonElement).disabled, true);
});

test("sold-out and elapsed slots explain why and offer a direct alternative date", async () => {
  globalThis.fetch = async () => Response.json({ slots: [{ time: "09:00", available:false, reason:"past" }, { time:"10:00", available:false, reason:"booked" }] });
  render(<SlotPicker today="2099-09-23" professor={professor} onPick={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: /2099년 9월 24일/ }));
  await screen.findByRole("button", { name: "09:00 지난 시간" });
  assert.ok(screen.getByRole("button", { name: "10:00 예약 마감" }));
  fireEvent.click(screen.getByRole("button", { name: "다른 날짜 선택" }));
  assert.equal(document.activeElement, screen.getByRole("heading", { name: "상담 날짜를 선택하세요" }));
});

