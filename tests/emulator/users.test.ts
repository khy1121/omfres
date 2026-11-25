// 계정 유형 변경과 그룹 참여의 경합 테스트 — `npm run test:emulator`로만 실행한다.
import { test } from "node:test";
import assert from "node:assert/strict";
import "./guard";
import { seedStudent } from "./seed";
import * as courses from "../../src/lib/data/courses";
import { saveProfileGuarded } from "../../src/lib/data/users";
import { db } from "../../src/lib/firebase/admin";

const prof = { uid: "us-prof", name: "김교수", email: "prof@hansung.ac.kr", studentNo: null };

async function newCourse(title: string) {
  const id = await courses.createCourse(prof, { title, term: "2026년 2학기", description: "" });
  return { id, token: (await courses.getCourse(id))!.currentInvite!.token };
}

test("only student accounts can join, checked inside the transaction", async () => {
  const { token } = await newCourse("유형 확인");
  const noDoc = { uid: "us-nodoc", name: "문서없음", email: null, studentNo: "2070001" };
  assert.deepEqual(await courses.joinByInvite(token, noDoc), { ok: false, status: "not_student" });
  const ins = { uid: "us-ins", name: "교수계정", email: null, studentNo: null };
  await db().collection("users").doc(ins.uid).set({ accountType: "instructor", name: ins.name });
  assert.deepEqual(await courses.joinByInvite(token, ins), { ok: false, status: "not_student" });
});

test("changing account type is refused while a membership exists; other edits are allowed", async () => {
  const { token } = await newCourse("유형 변경");
  const s = { uid: "us-s1", name: "학생", email: null, studentNo: "2070002" };
  await seedStudent(s);
  assert.equal((await courses.joinByInvite(token, s)).ok, true);
  assert.equal(await saveProfileGuarded(s.uid, { accountType: "instructor", name: "학생", studentNo: null }), "has_membership");
  assert.equal(await saveProfileGuarded(s.uid, { accountType: "student", name: "새이름", studentNo: "2070002" }), "saved");
  assert.equal((await db().collection("users").doc(s.uid).get()).data()?.accountType, "student");
});

test("concurrent join and switch-to-instructor never leave an instructor enrolled as a student", async () => {
  const { id, token } = await newCourse("경합");
  let joined = 0;
  let switched = 0;
  for (let round = 0; round < 10; round++) {
    const s = { uid: `us-race-${round}`, name: `학생${round}`, email: null, studentNo: `20710${round}` };
    await seedStudent(s);
    const [join, save] = await Promise.all([
      courses.joinByInvite(token, s),
      saveProfileGuarded(s.uid, { accountType: "instructor", name: s.name, studentNo: null }),
    ]);
    const type = (await db().collection("users").doc(s.uid).get()).data()?.accountType;
    const member = (await courses.getCourseAccess(id, s.uid)) !== null;
    assert.ok(!(type === "instructor" && member), `round ${round}: instructor enrolled as student (join=${JSON.stringify(join)}, save=${save})`);
    if (member) joined++;
    if (type === "instructor") switched++;
  }
  assert.equal(joined + switched, 10, "each round ends in exactly one of the two outcomes");
});
