import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import BookingFlow from "../src/components/BookingFlow";
import { ProfessorsProvider } from "../src/components/ProfessorsProvider";
import { professor, slots, chooseTime } from "./fixtures";

test("booking preserves name and time across browser back, forward and in-app back", async () => {
  globalThis.fetch = async () => Response.json(slots);
  render(<ProfessorsProvider professors={[professor]}><BookingFlow today="2099-09-23" /></ProfessorsProvider>);
  fireEvent.click(screen.getByRole("button", { name: /테스트 교수님/ }));
  await chooseTime();
  fireEvent.click(screen.getByRole("button", { name: "선택한 일정으로 계속" }));
  fireEvent.change(screen.getByRole("textbox", { name: "이름" }), { target: { value: "테스트" } });
  await act(async () => { window.history.back(); });
  await waitFor(() => assert.ok(screen.getByRole("heading", { name: "시작 시간을 선택하세요" })));
  assert.equal((await screen.findByRole("button", { name: /^10:00/ })).getAttribute("aria-pressed"), "true");
  await act(async () => { window.history.forward(); });
  await waitFor(() => assert.equal((screen.getByRole("textbox", { name: "이름" }) as HTMLInputElement).value, "테스트"));
  fireEvent.click(screen.getByRole("button", { name: "뒤로" }));
  await waitFor(() => assert.ok(screen.getByRole("heading", { name: "시작 시간을 선택하세요" })));
  fireEvent.click(screen.getByRole("button", { name: "뒤로" }));
  await waitFor(() => assert.ok(screen.getByRole("heading", { name: "상담 날짜를 선택하세요" })));
  fireEvent.click(screen.getByRole("button", { name: /2099.*9.*24.*/ }));
  assert.equal((await screen.findByRole("button", { name: /^10:00/ })).getAttribute("aria-pressed"), "true");
});

test("changing professor retains a still-valid date and time", async () => {
  globalThis.fetch = async () => Response.json(slots);
  render(<ProfessorsProvider professors={[professor, { ...professor, id: "other", name: "다른 교수님" }]}><BookingFlow today="2099-09-23" /></ProfessorsProvider>);
  fireEvent.click(screen.getByRole("button", { name: /테스트 교수님/ }));
  await chooseTime();
  fireEvent.click(screen.getByRole("button", { name: "뒤로" }));
  await screen.findByRole("heading", { name: "상담 날짜를 선택하세요" });
  fireEvent.click(screen.getByRole("button", { name: "뒤로" }));
  fireEvent.click(await screen.findByRole("button", { name: /다른 교수님/ }));
  fireEvent.click(screen.getByRole("button", { name: /2099.*9.*24.*/ }));
  assert.equal((await screen.findByRole("button", { name: /^10:00/ })).getAttribute("aria-pressed"), "true");
});

test("browser Back during a pending save does not destroy the time-step history", async () => {
  let resolveSave!: (response: Response) => void;
  globalThis.fetch = async (_input, init) => init?.method === "POST"
    ? new Promise((resolve) => { resolveSave = resolve; }) : Response.json(slots);
  render(<ProfessorsProvider professors={[professor]}><BookingFlow today="2099-09-23" /></ProfessorsProvider>);
  fireEvent.click(screen.getByRole("button", { name: /테스트 교수님/ }));
  await chooseTime();
  fireEvent.click(screen.getByRole("button", { name: "선택한 일정으로 계속" }));
  fireEvent.change(screen.getByRole("textbox", { name: "이름" }), { target: { value: "테스트" } });
  fireEvent.click(screen.getByRole("button", { name: "예약하기" }));
  await act(async () => { window.history.back(); await new Promise((resolve) => setTimeout(resolve, 50)); });
  assert.ok(screen.getByRole("heading", { name: "정보를 입력하세요" }));
  await act(async () => resolveSave(Response.json({ error: "입력 확인이 필요합니다." }, { status: 400 })));
  fireEvent.click(screen.getByRole("button", { name: "뒤로" }));
  await screen.findByRole("heading", { name: "시작 시간을 선택하세요" });
});

test("back after a booking conflict returns to the calendar in one action", async () => {
  globalThis.fetch = async (_input, init) => init?.method === "POST"
    ? Response.json({ error: "이미 예약되었습니다." }, { status: 409 }) : Response.json(slots);
  render(<ProfessorsProvider professors={[professor]}><BookingFlow today="2099-09-23" /></ProfessorsProvider>);
  fireEvent.click(screen.getByRole("button", { name: /테스트 교수님/ }));
  await chooseTime();
  fireEvent.click(screen.getByRole("button", { name: "선택한 일정으로 계속" }));
  fireEvent.change(screen.getByRole("textbox", { name: "이름" }), { target: { value: "테스트" } });
  fireEvent.click(screen.getByRole("button", { name: "예약하기" }));
  await screen.findByRole("alert");
  await screen.findByRole("heading", { name: "시작 시간을 선택하세요" });
  fireEvent.click(screen.getByRole("button", { name: "뒤로" }));
  await screen.findByRole("heading", { name: "상담 날짜를 선택하세요" });
});
