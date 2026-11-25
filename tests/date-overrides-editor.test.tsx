import "./setup";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import DateOverridesEditor from "../src/components/schedules/DateOverridesEditor";
import type { DateOverride } from "../src/lib/schedule/rules";

afterEach(cleanup);

function Harness({ initial = [] as DateOverride[], exclude = [] as string[] }) {
  const [v, setV] = useState<DateOverride[]>(initial);
  return (
    <>
      <DateOverridesEditor overrides={v} onChange={setV} weekly={[{ days: [3], start: "10:00", end: "12:00" }]} from="2026-12-01" to="2026-12-31" excludeDates={exclude} />
      <output data-testid="value">{JSON.stringify(v)}</output>
    </>
  );
}

const value = () => JSON.parse(screen.getByTestId("value").textContent || "[]");

test("adds a changed day showing the usual hours, and an extra day with a badge", () => {
  render(<Harness />);
  fireEvent.change(screen.getByLabelText("날짜"), { target: { value: "2026-12-09" } });
  fireEvent.change(screen.getByLabelText("시간대 1 시작"), { target: { value: "14:00" } });
  fireEvent.change(screen.getByLabelText("시간대 1 종료"), { target: { value: "17:00" } });
  fireEvent.click(screen.getByRole("button", { name: "이 날짜 시간 변경 추가" }));
  assert.deepEqual(value(), [{ date: "2026-12-09", windows: [{ start: "14:00", end: "17:00" }] }]);
  assert.ok(screen.getByText(/평소 10:00 ~ 12:00/));

  fireEvent.change(screen.getByLabelText("날짜"), { target: { value: "2026-12-12" } });
  fireEvent.click(screen.getByRole("button", { name: "+ 같은 날 시간대 하나 더" }));
  fireEvent.click(screen.getByRole("button", { name: "이 날짜 시간 변경 추가" }));
  assert.equal(value().length, 2);
  assert.ok(screen.getByText("추가된 날"));

  fireEvent.click(screen.getByRole("button", { name: /12월 9일.*시간 변경 삭제/ }));
  assert.deepEqual(value().map((o: DateOverride) => o.date), ["2026-12-12"]);
});

test("refuses dates outside the range, excluded dates, duplicates and overlapping ranges", () => {
  render(<Harness initial={[{ date: "2026-12-09", windows: [{ start: "10:00", end: "11:00" }] }]} exclude={["2026-12-02"]} />);
  const tryAdd = (date: string) => {
    fireEvent.change(screen.getByLabelText("날짜"), { target: { value: date } });
    fireEvent.click(screen.getByRole("button", { name: "이 날짜 시간 변경 추가" }));
  };
  tryAdd("2027-01-05");
  assert.ok(screen.getByText(/상담 기간 안/));
  tryAdd("2026-12-02");
  assert.ok(screen.getByText(/제외일로 지정된/));
  tryAdd("2026-12-09");
  assert.ok(screen.getByText(/이미 시간 변경을 넣은/));
  fireEvent.click(screen.getByRole("button", { name: "+ 같은 날 시간대 하나 더" }));
  fireEvent.change(screen.getByLabelText("시간대 2 시작"), { target: { value: "11:00" } });
  tryAdd("2026-12-16");
  assert.ok(screen.getByText(/겹칩니다/));
  assert.equal(value().length, 1, "nothing added");
});
