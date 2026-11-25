import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { fireEvent, render, screen } from "@testing-library/react";
import AdminPanel from "../src/components/AdminPanel";
import { ProfessorsProvider } from "../src/components/ProfessorsProvider";
import { professor, reservation } from "./fixtures";

const now = Date.parse("2099-09-23T00:00:00+09:00");

test("admin CSV uses the same name, past-time, and calendar scope as the current result", async () => {
  const rows = [reservation, {...reservation,id:"r2",name:"다른학생",date:"2099-10-01"}, {...reservation,id:"r3",date:"2099-09-22"}];
  let downloaded: Blob | undefined;
  const create = URL.createObjectURL;
  const revoke = URL.revokeObjectURL;
  const click = window.HTMLAnchorElement.prototype.click;
  URL.createObjectURL = (blob) => { downloaded = blob as Blob; return "blob:test"; };
  URL.revokeObjectURL = () => {};
  window.HTMLAnchorElement.prototype.click = () => {};
  try {
    render(<ProfessorsProvider professors={[professor]}><AdminPanel initialAuthed initialRows={rows} today="2099-09-23" initialNow={now} /></ProfessorsProvider>);
    fireEvent.click(screen.getByRole("button", {name:"학생별"}));
    fireEvent.change(screen.getByRole("textbox", {name:"이름 검색"}), {target:{value:reservation.name}});
    fireEvent.click(screen.getByRole("button", {name:"현재 결과 CSV (1건)"}));
    let csv = await downloaded!.text();
    assert.ok(csv.includes("2099-09-24")); assert.ok(!csv.includes("2099-09-22")); assert.ok(!csv.includes("다른학생"));
    fireEvent.click(screen.getByRole("checkbox", {name:"지난 예약 표시"}));
    fireEvent.click(screen.getByRole("button", {name:"현재 결과 CSV (2건)"}));
    assert.ok((await downloaded!.text()).includes("2099-09-22"));
    fireEvent.click(screen.getByRole("button", {name:"전체 예약"}));
    fireEvent.click(screen.getByRole("button", {name:"캘린더"}));
    fireEvent.click(screen.getByRole("button", {name:"다음 달"}));
    fireEvent.click(screen.getByRole("button", {name:"현재 결과 CSV (1건)"}));
    csv = await downloaded!.text();
    assert.ok(csv.includes("2099-10-01")); assert.ok(!csv.includes("2099-09-24"));
    fireEvent.click(screen.getByRole("button", {name:"전체 CSV (3건)"}));
    assert.equal((await downloaded!.text()).split("\r\n").length, 4);
  } finally { URL.createObjectURL = create; URL.revokeObjectURL = revoke; window.HTMLAnchorElement.prototype.click = click; }
});

