import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { act, fireEvent, render, screen } from "@testing-library/react";
import SlotPicker from "../src/components/SlotPicker";
import { professor, slots } from "./fixtures";

test("choosing a time does not submit until explicit confirmation", async () => {
  globalThis.fetch = async () => Response.json(slots);
  const picked: string[] = [];
  render(<SlotPicker today="2099-09-23" professor={professor} onPick={(d, t) => { picked.push(`${d} ${t}`); }} />);
  fireEvent.click(screen.getByRole("button", { name: /2099.*9.*24.*/ }));
  fireEvent.click(await screen.findByRole("button", { name: /^10:00/ }));
  assert.deepEqual(picked, []);
  fireEvent.click(screen.getByRole("button", { name: "선택한 일정으로 계속" }));
  assert.deepEqual(picked, ["2099-09-24 10:00"]);
});

test("slot lookup failure provides retry and ignores an older date response", async () => {
  let release!: (response: Response) => void;
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    if (requests === 1) return new Promise((resolve) => { release = resolve; });
    if (requests === 2) throw new Error("조회 실패");
    return Response.json({ slots: [{ time: "11:00", available: true }] });
  };
  render(<SlotPicker today="2099-09-23" professor={professor} onPick={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: /2099.*9.*24.*/ }));
  fireEvent.click(screen.getByRole("button", { name: "뒤로" }));
  fireEvent.click(screen.getByRole("button", { name: /2099.*9.*25.*/ }));
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "다시 불러오기" }));
  await screen.findByRole("button", { name: "11:00" });
  await act(async () => release(Response.json(slots)));
  assert.equal(screen.queryByRole("button", { name: /^10:00/ }), null);
  assert.ok(screen.getByRole("button", { name: "11:00" }));
});
