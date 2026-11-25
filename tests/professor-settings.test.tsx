import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import ProfessorManager from "../src/components/ProfessorManager";
import DateListInput from "../src/components/DateListInput";
import { ProfessorsProvider } from "../src/components/ProfessorsProvider";
import { professor, reservation } from "./fixtures";

const now = Date.parse("2099-09-23T00:00:00+09:00");

test("date list rejects empty additions and exposes selected dates with remove actions", () => {
  function Editor() { const [value,setValue] = useState(""); return <DateListInput label="제외 날짜" value={value} onChange={setValue} />; }
  render(<Editor />);
  fireEvent.click(screen.getByRole("button", {name:"추가"}));
  assert.ok(screen.getByRole("alert"));
  fireEvent.change(screen.getByLabelText("제외 날짜"), {target:{value:"2099-09-24"}});
  fireEvent.click(screen.getByRole("button", {name:"추가"}));
  fireEvent.click(screen.getByRole("button", {name:"제외 날짜 2099-09-24 제거"}));
  assert.ok(screen.getByText("선택한 날짜 없음"));
});

test("professor changes fetch fresh reservations and require impact confirmation before PUT", async () => {
  const methods: string[] = [];
  globalThis.fetch = async (_input, init) => { methods.push(init?.method ?? "GET"); return Response.json(init?.method === "PUT" ? {ok:true} : {reservations:[reservation]}); };
  const router = { bfcacheId: "test", back(){}, forward(){}, refresh(){}, push(){}, replace(){}, prefetch:async () => {} };
  render(<AppRouterContext.Provider value={router}><ProfessorsProvider professors={[professor]}><ProfessorManager rows={[]} now={now} /></ProfessorsProvider></AppRouterContext.Provider>);
  fireEvent.click(screen.getByRole("button", {name:"수정"}));
  fireEvent.change(screen.getByRole("spinbutton", {name:"상담 1회 시간 (분)"}), {target:{value:"60"}});
  fireEvent.click(screen.getByRole("button", {name:"변경 영향 확인"}));
  await screen.findByText("영향을 받는 예약 1건 (예정·진행 상태 기준)");
  assert.deepEqual(methods, ["GET"]);
  fireEvent.click(screen.getByRole("button", {name:"수정으로 돌아가기"}));
  assert.equal((screen.getByRole("spinbutton", {name:"상담 1회 시간 (분)"}) as HTMLInputElement).value, "60");
  fireEvent.click(screen.getByRole("button", {name:"변경 영향 확인"}));
  fireEvent.click(await screen.findByRole("button", {name:"영향 확인 후 저장"}));
  await waitFor(() => assert.deepEqual(methods, ["GET","GET","PUT"]));
});
