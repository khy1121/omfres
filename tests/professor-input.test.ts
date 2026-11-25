import { test } from "node:test";
import assert from "node:assert/strict";
import { type Professor } from "../src/lib/config";
import { validateProfessorInput } from "../src/lib/professor-input";
import { scheduleImpact } from "../src/lib/schedule-impact";
const p: Professor = { id: "p", name: "교수님", slotMinutes: 30, availability: [{ days: [0,1,2,3,4,5,6], start: "09:00", end: "17:00" }] };
test("invalid exception dates are rejected instead of silently removed", () => {
  for (const date of ["tomorrow", "2026-02-30"]) {
    const result = validateProfessorInput("p", {...p, excludeDates:[date]});
    assert.ok("error" in result);
    assert.match(result.error, /날짜/);
  }
});
test("schedule preview detects duration and schedule changes only for future matching reservations", () => {
  const r = {id:"r", professorId:"p", name:"학생", date:"2026-09-24", time:"09:00", createdAt:""};
  const now = Date.parse("2026-09-23T00:00:00+09:00");
  assert.equal(scheduleImpact(p, {...p, name:"새 이름"}, [r], now).length, 0);
  assert.equal(scheduleImpact(p, {...p, slotMinutes:60}, [r], now).length, 1);
  assert.equal(scheduleImpact(p, {...p, excludeDates:[r.date]}, [r], now).length, 1);
  assert.equal(scheduleImpact(p, {...p, slotMinutes:60}, [{...r,professorId:"other"}, {...r,date:"2026-09-22"}], now).length, 0);
  assert.equal(scheduleImpact(p, {...p, slotMinutes:60}, [r], Date.parse("2026-09-24T09:20:00+09:00")).length, 1);
  assert.equal(scheduleImpact(p, {...p, slotMinutes:60}, [r], Date.parse("2026-09-24T09:45:00+09:00")).length, 1);
});
