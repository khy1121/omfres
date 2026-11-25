import { test } from "node:test";
import assert from "node:assert/strict";
import { emailDomain, instructorDomains, isInstructorEligible, parseDomains } from "../src/lib/auth/instructor";
import { isInstructorProfile, isProfileComplete, isStudentProfileComplete, parseProfileInput } from "../src/lib/profile";
import { safeNextPath } from "../src/lib/safe-redirect";

const domains = parseDomains(" hansung.ac.kr, @HANSUNG.kr ,,");

test("school domains are parsed, lowercased and stripped of @", () => {
  assert.deepEqual(domains, ["hansung.ac.kr", "hansung.kr"]);
  assert.deepEqual(parseDomains(undefined), []);
});

test("only verified emails on an exact school domain may choose the instructor type", () => {
  assert.equal(isInstructorEligible("prof@hansung.ac.kr", true, domains), true);
  assert.equal(isInstructorEligible("Prof@Hansung.KR", true, domains), true);
  assert.equal(isInstructorEligible("prof@hansung.ac.kr", false, domains), false, "unverified email");
  assert.equal(isInstructorEligible("x@mail.hansung.ac.kr", true, domains), false, "subdomain");
  assert.equal(isInstructorEligible("x@hansung.ac.kr.evil.com", true, domains), false, "suffix trick");
  assert.equal(isInstructorEligible("x@nothansung.kr", true, domains), false, "lookalike");
  assert.equal(isInstructorEligible("student@gmail.com", true, domains), false);
  assert.equal(isInstructorEligible(null, true, domains), false);
  assert.equal(isInstructorEligible("prof@hansung.ac.kr", true, []), false, "no domains configured");
  assert.equal(emailDomain("a@b@hansung.kr"), "hansung.kr");
});

test("an account type must be chosen", () => {
  assert.ok("error" in parseProfileInput({ name: "홍길동", studentNo: "2071234" }, true));
  assert.ok("error" in parseProfileInput({ accountType: "admin", name: "홍길동" }, true));
  assert.ok("error" in parseProfileInput(null, true));
});

test("students must provide a name and a numeric student number", () => {
  const s = (v: object) => parseProfileInput({ accountType: "student", ...v }, false);
  assert.deepEqual(s({ name: " 홍길동 ", studentNo: " 2071234 " }), { data: { accountType: "student", name: "홍길동", studentNo: "2071234" } });
  assert.ok("error" in s({ name: "홍길동", studentNo: "" }));
  assert.ok("error" in s({ name: "홍길동" }));
  assert.ok("error" in s({ name: "홍길동", studentNo: "20-71234" }));
  assert.ok("error" in s({ name: "홍", studentNo: "2071234" }));
  assert.ok("error" in s({ name: "가".repeat(21), studentNo: "2071234" }));
});

test("school-domain students can still choose the student type", () => {
  assert.ok("data" in parseProfileInput({ accountType: "student", name: "홍길동", studentNo: "2071234" }, true));
});

test("instructor type requires a school account and drops the student number", () => {
  assert.deepEqual(parseProfileInput({ accountType: "instructor", name: "김교수", studentNo: "2071234" }, true), {
    data: { accountType: "instructor", name: "김교수", studentNo: null },
  });
  const denied = parseProfileInput({ accountType: "instructor", name: "김교수" }, false);
  assert.ok("error" in denied && /학교 계정/.test(denied.error));
  assert.ok("error" in parseProfileInput({ accountType: "instructor", name: "" }, true));
});

test("instructor permission is re-checked against the current school eligibility", () => {
  const prof = { accountType: "instructor" as const, name: "김교수", studentNo: null };
  assert.equal(isInstructorProfile(prof, true), true);
  assert.equal(isInstructorProfile(prof, false), false, "stored type alone is not enough");
  assert.equal(isInstructorProfile({ ...prof, accountType: "student" }, true), false);
});

test("profile completeness depends on the chosen type", () => {
  assert.equal(isProfileComplete({ accountType: null, name: "홍길동", studentNo: "2071234" }, true), false);
  assert.equal(isProfileComplete({ accountType: "student", name: "홍길동", studentNo: null }, true), false);
  assert.equal(isProfileComplete({ accountType: "student", name: "홍길동", studentNo: "2071234" }, false), true);
  assert.equal(isProfileComplete({ accountType: "instructor", name: "김교수", studentNo: null }, true), true);
  assert.equal(isStudentProfileComplete({ name: "홍길동", studentNo: "2071234" }), true);
  assert.equal(isStudentProfileComplete({ name: "홍길동", studentNo: null }), false);
});

test("login redirect only allows same-site absolute paths", () => {
  assert.equal(safeNextPath("/courses/abc?x=1"), "/courses/abc?x=1");
  assert.equal(safeNextPath("https://evil.com"), "/");
  assert.equal(safeNextPath("//evil.com"), "/");
  assert.equal(safeNextPath("/\\evil.com"), "/");
  assert.equal(safeNextPath("me"), "/");
  assert.equal(safeNextPath(undefined, "/me"), "/me");
});

test("missing instructor domains are reported once and allow nobody", () => {
  const warnings: string[] = [];
  assert.deepEqual(instructorDomains({ INSTRUCTOR_EMAIL_DOMAINS: "hansung.ac.kr" }, (m) => warnings.push(m)), ["hansung.ac.kr"]);
  assert.equal(warnings.length, 0);
  assert.deepEqual(instructorDomains({}, (m) => warnings.push(m)), []);
  assert.deepEqual(instructorDomains({ INSTRUCTOR_EMAIL_DOMAINS: " , " }, (m) => warnings.push(m)), []);
  assert.equal(warnings.length, 1, "warned only once");
  assert.match(warnings[0], /INSTRUCTOR_EMAIL_DOMAINS/);
});
