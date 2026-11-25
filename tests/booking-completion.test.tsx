import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import BookingFlow from "../src/components/BookingFlow";
import MyReservations from "../src/components/MyReservations";
import { ProfessorsProvider } from "../src/components/ProfessorsProvider";
import { professor, reservation, slots, chooseTime } from "./fixtures";

const now = Date.parse("2099-09-23T00:00:00+09:00");

test("completed booking hands the name to a fresh lookup without another input", async () => {
  const requests: string[] = [];
  globalThis.fetch = async (input, init) => {
    requests.push(String(input));
    if (init?.method === "POST") return Response.json({ reservation: { ...reservation, time:"10:00" } });
    if (String(input).includes("/api/slots")) return Response.json(slots);
    return Response.json({ reservations: [reservation] });
  };
  function Session() {
    const [page, setPage] = useState("booking");
    return <ProfessorsProvider professors={[professor]}><div onClickCapture={(e) => {
      if ((e.target as HTMLElement).closest('a[href="/my"]')) { e.preventDefault(); setPage("my"); }
    }}>{page === "booking" ? <BookingFlow today="2099-09-23" /> : <MyReservations today="2099-09-23" initialNow={now} />}</div></ProfessorsProvider>;
  }
  render(<Session />);
  fireEvent.click(screen.getByRole("button", { name:/테스트 교수님/ }));
  await chooseTime();
  fireEvent.click(screen.getByRole("button", { name:"선택한 일정으로 계속" }));
  fireEvent.change(screen.getByRole("textbox", { name:"이름" }), { target:{value:reservation.name} });
  fireEvent.click(screen.getByRole("button", { name:"예약하기" }));
  fireEvent.click(await screen.findByRole("link", { name:"내 예약 확인" }));
  await screen.findByRole("heading", { name:"내 예약" });
  assert.equal(screen.queryByRole("textbox", { name:"이름" }), null);
  assert.ok(requests.includes(`/api/reservations?name=${encodeURIComponent(reservation.name)}`));
  assert.equal(window.location.search, "");
  assert.equal(window.localStorage.length, 0);
  assert.equal(window.sessionStorage.length, 0);
});

