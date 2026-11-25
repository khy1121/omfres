import "./setup";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Calendar from "../src/components/Calendar";
import BookingPicker from "../src/components/schedules/BookingPicker";
import type { SlotConfig } from "../src/lib/schedule/rules";

afterEach(cleanup);

test("calendar announces date state, moves keyboard focus across months, and stops at the final month", () => {
  const selected: string[] = [];
  render(<Calendar today="2099-09-23" max="2099-11-22" selected={null} isSelectable={(d) => d !== "2099-10-01"} unavailableReason={() => "상담 제외일"} onSelect={(d) => selected.push(d)} />);
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

test("calendar opens on the first consultation month when it starts later", () => {
  render(<Calendar today="2099-09-23" start="2099-11-03" max="2099-12-31" selected={null} isSelectable={() => true} onSelect={() => {}} />);
  assert.ok(screen.getByText("2099년 11월"));
});

// ── BookingPicker ──

const cfg: SlotConfig = {
  slotMinutes: 30,
  ruleType: "recurring",
  recurring: { from: "2099-09-23", to: "2099-10-31", windows: [{ days: [0, 1, 2, 3, 4, 5, 6], start: "10:00", end: "11:30" }], excludeDates: [] },
  manualSlots: [],
};

type Call = { url: string; method: string; body?: unknown };

function mockFetch(handler: (c: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const c = { url: String(url), method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(c);
    return handler(c);
  }) as typeof fetch;
  return calls;
}

const END: Record<string, string> = { "10:00": "10:30", "10:30": "11:00", "11:00": "11:30" };
const slotsResponse = (taken: string[] = []) =>
  Response.json({
    slots: Object.keys(END).map((t) => ({ time: t, end: END[t], available: !taken.includes(t), reason: taken.includes(t) ? "taken" : null })),
    quota: { used: 0, max: 1 },
  });

const booking = { id: "b1", date: "2099-09-24", time: "10:30", endTime: "11:00", status: "booked", scheduleTitle: "면담", mode: "offline", location: "709호" };

test("slot states explain why a time cannot be picked", async () => {
  mockFetch((c) => (c.url.includes("/slots") ? slotsResponse(["10:00"]) : Response.json({})));
  render(<BookingPicker courseId="c" scheduleId="s" cfg={cfg} today="2099-09-23" onDone={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: /2099년 9월 24일/ }));
  const taken = await screen.findByRole("button", { name: "10:00~10:30 마감" });
  assert.equal((taken as HTMLButtonElement).disabled, true);
  assert.ok(screen.getByRole("button", { name: "10:30~11:00 예약 가능" }));
  assert.equal((screen.getByRole("button", { name: "이 시간으로 예약" }) as HTMLButtonElement).disabled, true, "nothing selected yet");
});

test("losing a race keeps the date, explains, and reloads fresh slots", async () => {
  let slotLoads = 0;
  const calls = mockFetch((c) => {
    if (c.url.includes("/slots")) {
      slotLoads++;
      return slotsResponse(slotLoads > 1 ? ["10:30"] : []);
    }
    return Response.json({ error: "방금 다른 학생이 이 시간을 예약했습니다. 다른 시간을 선택해주세요.", code: "SLOT_TAKEN" }, { status: 409 });
  });
  render(<BookingPicker courseId="c" scheduleId="s" cfg={cfg} today="2099-09-23" onDone={() => assert.fail("must not finish")} />);
  fireEvent.click(screen.getByRole("button", { name: /2099년 9월 24일/ }));
  fireEvent.click(await screen.findByRole("button", { name: "10:30~11:00 예약 가능" }));
  fireEvent.click(screen.getByRole("button", { name: "이 시간으로 예약" }));
  assert.ok(await screen.findByText(/방금 다른 학생이/));
  assert.ok(await screen.findByRole("button", { name: "10:30~11:00 마감" }), "slots reloaded");
  assert.ok(screen.getByRole("heading", { name: /2099년 9월 24일/ }), "date kept");
  assert.deepEqual(calls.find((c) => c.method === "POST")?.body, { scheduleId: "s", date: "2099-09-24", time: "10:30" });
});

test("a lost response blocks resubmission until the result is checked", async () => {
  let posted = false;
  const done: unknown[] = [];
  mockFetch((c) => {
    if (c.url.includes("/slots")) return slotsResponse();
    if (c.method === "POST") {
      posted = true;
      throw new TypeError("network");
    }
    // 결과 확인: 서버에는 예약이 들어가 있었다
    return Response.json({ bookings: [booking] });
  });
  render(<BookingPicker courseId="c" scheduleId="s" cfg={cfg} today="2099-09-23" onDone={(b) => done.push(b)} />);
  fireEvent.click(screen.getByRole("button", { name: /2099년 9월 24일/ }));
  fireEvent.click(await screen.findByRole("button", { name: "10:30~11:00 예약 가능" }));
  fireEvent.click(screen.getByRole("button", { name: "이 시간으로 예약" }));
  const verify = await screen.findByRole("button", { name: "예약 결과 확인" });
  assert.ok(posted);
  assert.equal(screen.queryByRole("button", { name: "이 시간으로 예약" }), null, "resubmit hidden");
  assert.equal((screen.getByRole("button", { name: "11:00~11:30 예약 가능" }) as HTMLButtonElement).disabled, true, "slots locked");
  fireEvent.click(verify);
  await waitFor(() => assert.equal(done.length, 1));
});

test("when the check finds nothing, the selection is kept for an explicit retry", async () => {
  mockFetch((c) => {
    if (c.url.includes("/slots")) return slotsResponse();
    if (c.method === "POST") return new Response("upstream", { status: 502 });
    return Response.json({ bookings: [] });
  });
  render(<BookingPicker courseId="c" scheduleId="s" cfg={cfg} today="2099-09-23" onDone={() => assert.fail("not booked")} />);
  fireEvent.click(screen.getByRole("button", { name: /2099년 9월 24일/ }));
  fireEvent.click(await screen.findByRole("button", { name: "10:30~11:00 예약 가능" }));
  fireEvent.click(screen.getByRole("button", { name: "이 시간으로 예약" }));
  fireEvent.click(await screen.findByRole("button", { name: "예약 결과 확인" }));
  assert.ok(await screen.findByText(/처리된 예약이 없습니다/));
  assert.ok(await screen.findByRole("button", { name: "이 시간으로 예약" }));
});

test("moving sends a PATCH for the existing booking and passes the booking to the slot query", async () => {
  const calls = mockFetch((c) => (c.url.includes("/slots") ? slotsResponse() : Response.json({ booking: { ...booking, time: "11:00" } })));
  const done: unknown[] = [];
  render(<BookingPicker courseId="c" scheduleId="s" cfg={cfg} today="2099-09-23" moving={{ bookingId: "b1", date: "2099-09-24", time: "10:30" }} onDone={(b) => done.push(b)} />);
  assert.ok(screen.getByText(/현재 예약/));
  fireEvent.click(screen.getByRole("button", { name: /2099년 9월 24일/ }));
  fireEvent.click(await screen.findByRole("button", { name: "11:00~11:30 예약 가능" }));
  fireEvent.click(screen.getByRole("button", { name: "이 시간으로 변경" }));
  await waitFor(() => assert.equal(done.length, 1));
  assert.ok(calls.some((c) => c.url.includes("/slots") && c.url.includes("booking=b1")));
  assert.deepEqual(calls.find((c) => c.method === "PATCH"), { url: "/api/bookings/b1", method: "PATCH", body: { date: "2099-09-24", time: "11:00" } });
});

test("the calendar shows remaining counts and blocks fully booked dates", async () => {
  mockFetch((c) => {
    if (c.url.includes("/availability")) return Response.json({ days: { "2099-09-24": 3, "2099-09-25": 0 }, next: { date: "2099-09-24", time: "10:30" } });
    if (c.url.includes("/slots")) return slotsResponse(["10:00"]);
    return Response.json({});
  });
  render(<BookingPicker courseId="c" scheduleId="s" cfg={cfg} today="2099-09-23" onDone={() => {}} />);
  const open = await screen.findByRole("button", { name: /2099년 9월 24일.*예약 가능 시간 3개/ });
  assert.ok(open.textContent?.includes("3개"));
  const full = screen.getByRole("button", { name: /2099년 9월 25일.*마감/ });
  assert.equal(full.getAttribute("aria-disabled"), "true");
  assert.ok(screen.getByText("날짜 아래 숫자는 지금 예약할 수 있는 시간 수입니다."));
});

test("if the counts cannot be loaded, dates stay selectable by the schedule rules", async () => {
  mockFetch((c) => (c.url.includes("/slots") ? slotsResponse() : new Response("down", { status: 503 })));
  render(<BookingPicker courseId="c" scheduleId="s" cfg={cfg} today="2099-09-23" onDone={() => {}} />);
  const day = screen.getByRole("button", { name: /2099년 9월 25일/ });
  assert.equal(day.getAttribute("aria-disabled"), "false");
  assert.equal(screen.queryByText("날짜 아래 숫자는 지금 예약할 수 있는 시간 수입니다."), null);
});
