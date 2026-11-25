import { test } from "node:test";
import assert from "node:assert/strict";
import { dateUnavailableReason, lastBookableDate, type Professor } from "../src/lib/config";
const p: Professor = { id: "p", name: "교수님", slotMinutes: 30, availability: [{ days: [0,1,2,3,4,5,6], start: "09:00", end: "17:00" }] };
test("calendar limits and unavailable dates have distinct reasons", () => {
  assert.equal(lastBookableDate("2026-12-20"), "2027-02-18");
  assert.match(dateUnavailableReason(p, "2026-02-30", "2026-02-01")!, /유효/);
  assert.match(dateUnavailableReason(p, "2026-09-22", "2026-09-23")!, /지난/);
  assert.match(dateUnavailableReason({...p, excludeDates:["2026-09-24"]}, "2026-09-24", "2026-09-23")!, /제외/);
  assert.equal(dateUnavailableReason(p, "2026-09-24", "2026-09-23"), null);
});
