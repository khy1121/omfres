import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultTerm,
  effectiveCourseRole,
  inviteStatus,
  isInviteTokenFormat,
  newInviteToken,
  parseCourseInput,
  parseInviteExpiry,
} from "../src/lib/courses/model";

test("course input is trimmed and validated", () => {
  assert.deepEqual(parseCourseInput({ title: " 자료구조 ", term: " 2026년 2학기 " }), {
    data: { title: "자료구조", term: "2026년 2학기", description: "" },
  });
  assert.ok("error" in parseCourseInput({ title: "  ", term: "2026년 2학기" }));
  assert.ok("error" in parseCourseInput({ title: "가".repeat(51), term: "2026년 2학기" }));
  assert.ok("error" in parseCourseInput({ title: "자료구조", term: "" }));
  assert.ok("error" in parseCourseInput({ title: "자료구조", term: "2026", description: "가".repeat(501) }));
  assert.ok("error" in parseCourseInput(null));
});

test("default term follows the Korean semester calendar", () => {
  assert.equal(defaultTerm(2026, 3), "2026년 1학기");
  assert.equal(defaultTerm(2026, 8), "2026년 1학기");
  assert.equal(defaultTerm(2026, 9), "2026년 2학기");
  assert.equal(defaultTerm(2026, 12), "2026년 2학기");
  assert.equal(defaultTerm(2027, 1), "2026년 2학기");
  assert.equal(defaultTerm(2027, 2), "2026년 2학기");
});

test("invite tokens are unguessable url-safe strings", () => {
  const tokens = new Set(Array.from({ length: 200 }, newInviteToken));
  assert.equal(tokens.size, 200);
  for (const t of tokens) assert.ok(isInviteTokenFormat(t), t);
  assert.equal(isInviteTokenFormat("short"), false);
  assert.equal(isInviteTokenFormat("a".repeat(31) + "/"), false);
  assert.equal(isInviteTokenFormat(undefined), false);
});

test("invite expiry accepts only none, 7 or 30 days", () => {
  assert.deepEqual(parseInviteExpiry(null), { days: null });
  assert.deepEqual(parseInviteExpiry(""), { days: null });
  assert.deepEqual(parseInviteExpiry("7"), { days: 7 });
  assert.deepEqual(parseInviteExpiry(30), { days: 30 });
  assert.ok("error" in parseInviteExpiry(1));
  assert.ok("error" in parseInviteExpiry("forever"));
});

test("invite status covers revoked, rotated, expired and archived links", () => {
  const now = 1_000_000;
  const course = { archivedAt: null, currentToken: "T" };
  const inv = { courseId: "c", revokedAt: null, expiresAt: null };
  assert.equal(inviteStatus("T", inv, course, now), "ok");
  assert.equal(inviteStatus("T", null, course, now), "not_found");
  assert.equal(inviteStatus("T", inv, null, now), "not_found");
  assert.equal(inviteStatus("T", { ...inv, revokedAt: 1 }, course, now), "revoked");
  assert.equal(inviteStatus("OLD", inv, course, now), "revoked", "a rotated link stops working even without revokedAt");
  assert.equal(inviteStatus("T", inv, { ...course, currentToken: null }, now), "revoked", "link turned off");
  assert.equal(inviteStatus("T", { ...inv, expiresAt: now }, course, now), "expired");
  assert.equal(inviteStatus("T", { ...inv, expiresAt: now + 1 }, course, now), "ok");
  assert.equal(inviteStatus("T", inv, { ...course, archivedAt: 5 }, now), "archived");
});

test("owner privileges require a current instructor account", () => {
  assert.equal(effectiveCourseRole("owner", true), "owner");
  assert.equal(effectiveCourseRole("owner", false), "student", "owner who lost instructor eligibility");
  assert.equal(effectiveCourseRole("student", true), "student");
  assert.equal(effectiveCourseRole("student", false), "student");
});
