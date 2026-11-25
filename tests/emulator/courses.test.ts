// Firestore 에뮬레이터 통합 테스트 — `npm run test:emulator`로만 실행한다.
import { before, test } from "node:test";
import assert from "node:assert/strict";
// guard는 반드시 데이터 모듈보다 먼저 불러온다 (환경변수 정리 후 Firebase 초기화)
import "./guard";
import { joinAsStudent } from "./seed";
import * as data from "../../src/lib/data/courses";
import { db } from "../../src/lib/firebase/admin";

const prof = { uid: "prof-1", name: "김교수", email: "prof@hansung.ac.kr", studentNo: null };
const alice = { uid: "stu-a", name: "앨리스", email: "a@gmail.com", studentNo: "2071001" };
const bob = { uid: "stu-b", name: "밥", email: "b@hansung.ac.kr", studentNo: "2071002" };

async function clearAll() {
  await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${process.env.FIREBASE_PROJECT_ID}/databases/(default)/documents`, { method: "DELETE" });
}

before(clearAll);

async function tokenOf(courseId: string) {
  const c = await data.getCourse(courseId);
  assert.ok(c?.currentInvite);
  return c.currentInvite.token;
}

test("creating a course makes the creator owner and issues an invite", async () => {
  const id = await data.createCourse(prof, { title: "자료구조", term: "2026년 2학기", description: "" });
  const access = await data.getCourseAccess(id, prof.uid);
  assert.equal(access?.role, "owner");
  assert.equal(access?.course.ownerName, "김교수");
  assert.ok(access?.course.currentInvite?.token);
  const mine = await data.listMyCourses(prof.uid);
  assert.deepEqual(mine.map((c) => [c.id, c.role]), [[id, "owner"]]);
  assert.equal(await data.getCourseAccess(id, alice.uid), null, "non-members get nothing");
});

test("students join once via the invite; joining twice is idempotent", async () => {
  const id = await data.createCourse(prof, { title: "운영체제", term: "2026년 2학기", description: "" });
  const token = await tokenOf(id);
  assert.deepEqual(await joinAsStudent(token, alice), { ok: true, courseId: id, already: false });
  assert.deepEqual(await joinAsStudent(token, alice), { ok: true, courseId: id, already: true });
  assert.equal(await data.countStudents(id), 1);
  const members = await data.listMembers(id);
  assert.deepEqual(members.map((m) => [m.uid, m.role, m.studentNo]), [[prof.uid, "owner", null], [alice.uid, "student", "2071001"]]);
  const invite = await db().collection("invites").doc(token).get();
  assert.equal(invite.data()?.usedCount, 1);
});

test("concurrent joins by different students all succeed exactly once", async () => {
  const id = await data.createCourse(prof, { title: "동시 참여", term: "2026년 2학기", description: "" });
  const token = await tokenOf(id);
  const students = Array.from({ length: 30 }, (_, i) => ({ uid: `con-${i}`, name: `학생${i}`, email: null, studentNo: `2071${String(i).padStart(3, "0")}` }));
  const results = await Promise.all(students.flatMap((s) => [joinAsStudent(token, s), joinAsStudent(token, s)]));
  assert.ok(results.every((r) => r.ok));
  assert.equal(results.filter((r) => r.ok && !r.already).length, 30);
  assert.equal(await data.countStudents(id), 30);
  const invite = await db().collection("invites").doc(token).get();
  assert.equal(invite.data()?.usedCount, 30);
});

test("rotating the invite invalidates the old link immediately", async () => {
  const id = await data.createCourse(prof, { title: "네트워크", term: "2026년 2학기", description: "" });
  const old = await tokenOf(id);
  const fresh = await data.rotateInvite(id, prof.uid, 7);
  assert.notEqual(old, fresh);
  assert.deepEqual(await joinAsStudent(old, alice), { ok: false, status: "revoked" });
  assert.equal((await data.previewInvite(old)).status, "revoked");
  assert.equal((await joinAsStudent(fresh, alice)).ok, true);
  const course = await data.getCourse(id);
  assert.ok(course?.currentInvite?.expiresAt, "7-day expiry stored");
});

test("a disabled invite rejects joins until a new one is issued", async () => {
  const id = await data.createCourse(prof, { title: "데이터베이스", term: "2026년 2학기", description: "" });
  const token = await tokenOf(id);
  await data.disableInvite(id);
  assert.deepEqual(await joinAsStudent(token, bob), { ok: false, status: "revoked" });
  assert.equal((await data.getCourse(id))?.currentInvite, null);
  const next = await data.rotateInvite(id, prof.uid, null);
  assert.equal((await joinAsStudent(next, bob)).ok, true);
});

test("expired and unknown invites are rejected", async () => {
  const id = await data.createCourse(prof, { title: "만료", term: "2026년 2학기", description: "" });
  const token = await tokenOf(id);
  await db().collection("invites").doc(token).update({ expiresAt: new Date(Date.now() - 1000) });
  assert.deepEqual(await joinAsStudent(token, alice), { ok: false, status: "expired" });
  assert.deepEqual(await joinAsStudent("x".repeat(32), alice), { ok: false, status: "not_found" });
});

test("removing a student deletes both membership copies; the owner cannot be removed", async () => {
  const id = await data.createCourse(prof, { title: "컴파일러", term: "2026년 2학기", description: "" });
  await joinAsStudent(await tokenOf(id), bob);
  assert.equal(await data.removeStudent(id, prof.uid), "is_owner");
  assert.equal(await data.removeStudent(id, bob.uid), "removed");
  assert.equal(await data.removeStudent(id, bob.uid), "not_member");
  assert.equal(await data.getCourseAccess(id, bob.uid), null);
  assert.ok(!(await data.listMyCourses(bob.uid)).some((c) => c.id === id));
});

test("profile changes propagate to member copies and the owner name", async () => {
  const id = await data.createCourse({ ...prof, uid: "prof-sync" }, { title: "동기화", term: "2026년 2학기", description: "" });
  await joinAsStudent(await tokenOf(id), { ...alice, uid: "stu-sync" });
  await data.syncMemberProfile("stu-sync", "앨리스2", "2079999");
  await data.syncMemberProfile("prof-sync", "김교수2", null);
  const members = await data.listMembers(id);
  assert.equal(members.find((m) => m.uid === "stu-sync")?.name, "앨리스2");
  assert.equal(members.find((m) => m.uid === "stu-sync")?.studentNo, "2079999");
  assert.equal((await data.getCourse(id))?.ownerName, "김교수2");
  assert.equal(await data.hasAnyMembership("stu-sync"), true);
  assert.equal(await data.hasAnyMembership("nobody"), false);
});
