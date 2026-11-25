import { test } from "node:test";
import assert from "node:assert/strict";
import { reservationStatus, canChangeReservation } from "../src/lib/reservation-time";

const r = { date: "2026-09-23", time: "09:00" };
test("KST start and end boundaries distinguish upcoming, ongoing, and elapsed", () => {
  assert.equal(reservationStatus(r, 30, Date.parse("2026-09-22T23:59:59Z")), "upcoming");
  assert.equal(reservationStatus(r, 30, Date.parse("2026-09-23T00:00:00Z")), "ongoing");
  assert.equal(reservationStatus(r, 30, Date.parse("2026-09-23T00:29:59Z")), "ongoing");
  assert.equal(reservationStatus(r, 30, Date.parse("2026-09-23T00:30:00Z")), "elapsed");
});
test("changes close at the start, and midnight is evaluated in KST", () => {
  assert.equal(canChangeReservation(r, Date.parse("2026-09-22T23:59:59Z")), true);
  assert.equal(canChangeReservation(r, Date.parse("2026-09-23T00:00:00Z")), false);
  assert.equal(reservationStatus({ date: "2026-09-23", time: "00:00" }, 30, Date.parse("2026-09-22T15:30:00Z")), "elapsed");
});
test("missing duration is unknown after the start rather than an invented completion", () => {
  assert.equal(reservationStatus(r, undefined, Date.parse("2026-09-23T00:30:00Z")), "unknown");
});
