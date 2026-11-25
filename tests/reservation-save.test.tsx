import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import MyReservations from "../src/components/MyReservations";
import BookingFlow from "../src/components/BookingFlow";
import AdminEditor from "../src/components/AdminEditor";
import { ProfessorsProvider } from "../src/components/ProfessorsProvider";
import { professor, reservation, slots, chooseTime } from "./fixtures";

test("new booking conflict shows the error and refreshed slots without losing the name", async () => {
  let writes = 0;
  globalThis.fetch = async (_input, init) => {
    if (init?.method === "POST") { writes++; return Response.json({ error: "방금 다른 사람이 예약했습니다." }, { status: 409 }); }
    return Response.json({ slots: [{ time: "09:00", available: true }, { time: "10:00", available: writes === 0 }] });
  };
  render(<ProfessorsProvider professors={[professor]}><BookingFlow today="2099-09-23" /></ProfessorsProvider>);
  fireEvent.click(screen.getByRole("button", { name: /테스트 교수님/ }));
  await chooseTime();
  fireEvent.click(screen.getByRole("button", { name: "선택한 일정으로 계속" }));
  fireEvent.change(screen.getByRole("textbox", { name: "이름" }), { target: { value: "테스트" } });
  fireEvent.click(screen.getByRole("button", { name: "예약하기" }));
  await screen.findByRole("alert");
  await waitFor(() => assert.equal((screen.getByRole("button", { name: "10:00" }) as HTMLButtonElement).disabled, true));
  fireEvent.click(screen.getByRole("button", { name: "09:00" }));
  fireEvent.click(screen.getByRole("button", { name: "선택한 일정으로 계속" }));
  assert.equal((screen.getByRole("textbox", { name: "이름" }) as HTMLInputElement).value, "테스트");
});

test("a confirmed empty lookup offers an explicit draft-preserving retry after an uncertain save", async () => {
  let writes = 0;
  globalThis.fetch = async (input, init) => {
    if (init?.method === "POST") { writes++; throw new Error("offline before dispatch"); }
    if (String(input).includes("/api/slots")) return Response.json(slots);
    return Response.json({ reservations: [] });
  };
  render(<ProfessorsProvider professors={[professor]}><AdminEditor mode={{ kind: "create" }} today="2099-09-23" now={Date.parse("2099-09-23T00:00:00+09:00")}
    onCancel={() => {}} onDone={async () => {}} /></ProfessorsProvider>);
  fireEvent.change(screen.getByRole("textbox", { name: "이름" }), { target: { value: "테스트" } });
  fireEvent.click(screen.getByRole("button", { name: "다음" }));
  fireEvent.click(screen.getByRole("button", { name: /테스트 교수님/ }));
  await chooseTime();
  fireEvent.click(screen.getByRole("button", { name: "예약 확정" }));
  fireEvent.click(await screen.findByRole("button", { name: "예약 상태 확인" }));
  const retry = await screen.findByRole("button", { name: "입력 유지하고 다시 시도" });
  assert.equal(writes, 1);
  fireEvent.click(retry);
  await waitFor(() => assert.equal((screen.getByRole("button", { name: "예약 확정" }) as HTMLButtonElement).disabled, false));
  assert.equal(screen.getByRole("button", { name: "10:00" }).getAttribute("aria-pressed"), "true");
  assert.equal(writes, 1);
});

test("admin keeps the selected screen while saving and reconciles a lost response without another write", async () => {
  let writes = 0;
  let rejectSave!: (reason: Error) => void;
  const saved: string[] = [];
  globalThis.fetch = async (input, init) => {
    if (init?.method === "POST") { writes++; return new Promise((_resolve, reject) => { rejectSave = reject; }); }
    if (String(input).includes("/api/slots")) return Response.json(slots);
    return Response.json({ reservations: [{ ...reservation, time: "10:00" }] });
  };
  render(<ProfessorsProvider professors={[professor]}><AdminEditor mode={{ kind: "create" }} today="2099-09-23" now={Date.parse("2099-09-23T00:00:00+09:00")}
    onCancel={() => {}} onDone={async (message) => { saved.push(message); }} /></ProfessorsProvider>);
  fireEvent.change(screen.getByRole("textbox", { name: "이름" }), { target: { value: "테스트" } });
  fireEvent.click(screen.getByRole("button", { name: "다음" }));
  fireEvent.click(screen.getByRole("button", { name: /테스트 교수님/ }));
  await chooseTime();
  assert.equal(writes, 0);
  fireEvent.click(screen.getByRole("button", { name: "예약 확정" }));
  assert.ok(screen.getByRole("heading", { name: "시작 시간을 선택하세요" }));
  assert.equal(screen.getByRole("button", { name: "10:00" }).getAttribute("aria-pressed"), "true");
  assert.equal((screen.getByRole("button", { name: "저장 중" }) as HTMLButtonElement).disabled, true);
  await act(async () => rejectSave(new Error("lost response")));
  assert.ok(screen.getByRole("alert").textContent?.includes("처리 결과"));
  fireEvent.click(screen.getByRole("button", { name: "예약 확정" }));
  assert.equal(writes, 1);
  fireEvent.click(screen.getByRole("button", { name: "예약 상태 확인" }));
  await waitFor(() => assert.equal(saved.length, 1));
  assert.equal(writes, 1);
});

test("move conflict keeps selection, displays the error, and refreshes availability", async () => {
  let reads = 0;
  let writes = 0;
  globalThis.fetch = async (input, init) => {
    if (init?.method === "PATCH") { writes++; return Response.json({ error: "이미 예약된 시간입니다." }, { status: 409 }); }
    if (String(input).includes("/api/slots")) {
      reads++;
      return Response.json({ slots: [{ time: "09:00", available: false }, { time: "10:00", available: writes === 0 }] });
    }
    return Response.json({ reservations: [reservation] });
  };
  render(<ProfessorsProvider professors={[professor]}><MyReservations today="2099-09-23" initialNow={Date.parse("2099-09-23T00:00:00+09:00")} /></ProfessorsProvider>);
  fireEvent.change(screen.getByRole("textbox", { name: "이름" }), { target: { value: "테스트" } });
  fireEvent.click(screen.getByRole("button", { name: "조회하기" }));
  fireEvent.click(await screen.findByRole("button", { name: "수정" }));
  fireEvent.click(screen.getByRole("button", { name: "24" }));
  fireEvent.click(await screen.findByRole("button", { name: "10:00" }));
  assert.equal(writes, 0);
  fireEvent.click(screen.getByRole("button", { name: "이 일정으로 변경" }));
  await waitFor(() => assert.ok(screen.getByRole("alert").textContent?.includes("이미 예약")));
  await waitFor(() => assert.ok(reads >= 2));
  assert.equal(screen.getByRole("button", { name: "10:00" }).getAttribute("aria-pressed"), "true");
  assert.equal((screen.getByRole("button", { name: "이 일정으로 변경" }) as HTMLButtonElement).disabled, true);
});
