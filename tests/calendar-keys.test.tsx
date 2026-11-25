import "./setup";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import Calendar, { keyTarget } from "../src/components/Calendar";

afterEach(cleanup);

test("PageUp/PageDown은 한 달, Shift와 함께면 한 해를 옮기고 없는 날짜는 그 달 마지막 날로", () => {
  assert.equal(keyTarget("2030-03-15", "PageDown", false), "2030-04-15");
  assert.equal(keyTarget("2030-03-15", "PageUp", false), "2030-02-15");
  assert.equal(keyTarget("2030-01-31", "PageDown", false), "2030-02-28");
  assert.equal(keyTarget("2030-12-31", "PageDown", false), "2031-01-31");
  assert.equal(keyTarget("2032-02-29", "PageDown", true), "2033-02-28");
  assert.equal(keyTarget("2030-03-15", "Home", false), "2030-03-10"); // 일요일
  assert.equal(keyTarget("2030-03-15", "Tab", false), null);
});

test("키보드로 달을 옮기면 포커스와 달 제목이 따라가고, 범위 끝에서 멈춘다", () => {
  render(<Calendar selected={null} onSelect={() => {}} isSelectable={() => true} today="2030-03-15" max="2030-05-10" />);
  const day = (name: RegExp) => screen.getByRole("button", { name });
  day(/^2030년 3월 15일/).focus();
  fireEvent.keyDown(document.activeElement!, { key: "PageDown" });
  assert.equal(document.activeElement, day(/^2030년 4월 15일/));
  assert.ok(screen.getByRole("group", { name: "2030년 4월" }));
  fireEvent.keyDown(document.activeElement!, { key: "PageDown" });
  assert.equal(document.activeElement, day(/^2030년 5월 10일/)); // max에서 멈춤
  fireEvent.keyDown(document.activeElement!, { key: "PageUp", shiftKey: true });
  assert.equal(document.activeElement, day(/^2030년 3월 15일/)); // 오늘보다 앞으로는 못 감
});
