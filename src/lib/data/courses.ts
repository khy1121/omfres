import "server-only";
import { FieldValue, Timestamp, type DocumentReference, type Transaction } from "firebase-admin/firestore";
import { db } from "../firebase/admin";
import { userRef } from "./users";
import {
  inviteStatus,
  newInviteToken,
  type CourseInput,
  type CourseRole,
  type InviteExpiryDays,
  type InviteStatus,
} from "../courses/model";

// 수업 그룹 데이터 접근. 호출하는 쪽(API·화면)에서 로그인과 역할을 먼저 확인한다.
//
// courses/{courseId}                       그룹 (currentInvite에 현재 유효한 초대 토큰)
// courses/{courseId}/members/{uid}         멤버 (이름·학번·이메일 사본)
// users/{uid}/memberships/{courseId}       내 그룹 목록용 역방향 사본
// invites/{token}                          초대 링크 (서버 전용 저장소라 원본 토큰을 문서 ID로 사용)

export type Course = {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string | null;
  title: string;
  term: string;
  description: string;
  currentInvite: { token: string; expiresAt: string | null } | null;
  archivedAt: string | null;
  createdAt: string | null;
};

export type Member = {
  uid: string;
  role: CourseRole;
  name: string;
  studentNo: string | null;
  email: string | null;
  joinedAt: string | null;
};

type Person = { uid: string; name: string; email: string | null; studentNo: string | null };

const courses = () => db().collection("courses");
const courseRef = (id: string) => courses().doc(id);
const memberRef = (courseId: string, uid: string) => courseRef(courseId).collection("members").doc(uid);
const membershipRef = (uid: string, courseId: string) => db().collection("users").doc(uid).collection("memberships").doc(courseId);
const inviteRef = (token: string) => db().collection("invites").doc(token);

const iso = (v: unknown): string | null => (v instanceof Timestamp ? v.toDate().toISOString() : null);
const ms = (v: unknown): number | null => (v instanceof Timestamp ? v.toMillis() : null);

function toCourse(id: string, d: FirebaseFirestore.DocumentData): Course {
  const inv = d.currentInvite as { token: string; expiresAt: Timestamp | null } | null | undefined;
  return {
    id,
    ownerId: d.ownerId,
    ownerName: d.ownerName ?? "",
    ownerEmail: d.ownerEmail ?? null,
    title: d.title,
    term: d.term,
    description: d.description ?? "",
    currentInvite: inv ? { token: inv.token, expiresAt: iso(inv.expiresAt) } : null,
    archivedAt: iso(d.archivedAt),
    createdAt: iso(d.createdAt),
  };
}

function toMember(d: FirebaseFirestore.DocumentData): Member {
  return {
    uid: d.uid,
    role: d.role,
    name: d.name ?? "",
    studentNo: d.studentNo ?? null,
    email: d.email ?? null,
    joinedAt: iso(d.joinedAt),
  };
}

function addMember(tx: Transaction, courseId: string, person: Person, role: CourseRole) {
  tx.set(memberRef(courseId, person.uid), {
    uid: person.uid,
    role,
    name: person.name,
    studentNo: role === "student" ? person.studentNo : null,
    email: person.email,
    joinedAt: FieldValue.serverTimestamp(),
  });
  tx.set(membershipRef(person.uid, courseId), { courseId, role, joinedAt: FieldValue.serverTimestamp() });
}

function issueInvite(tx: Transaction, courseId: string, createdBy: string, days: InviteExpiryDays, previous: string | null) {
  const token = newInviteToken();
  const expiresAt = days ? Timestamp.fromMillis(Date.now() + days * 24 * 3600 * 1000) : null;
  if (previous) tx.set(inviteRef(previous), { revokedAt: FieldValue.serverTimestamp() }, { merge: true });
  tx.set(inviteRef(token), { courseId, createdBy, createdAt: FieldValue.serverTimestamp(), expiresAt, revokedAt: null, usedCount: 0 });
  tx.update(courseRef(courseId), { currentInvite: { token, expiresAt }, updatedAt: FieldValue.serverTimestamp() });
  return token;
}

export async function createCourse(owner: Person, input: CourseInput): Promise<string> {
  const ref = courses().doc();
  await db().runTransaction(async (tx) => {
    tx.set(ref, {
      ownerId: owner.uid,
      ownerName: owner.name,
      ownerEmail: owner.email,
      title: input.title,
      term: input.term,
      description: input.description,
      currentInvite: null,
      archivedAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    addMember(tx, ref.id, owner, "owner");
    issueInvite(tx, ref.id, owner.uid, null, null);
  });
  return ref.id;
}

export async function getCourse(courseId: string): Promise<Course | null> {
  if (!courseId || courseId.includes("/")) return null;
  const snap = await courseRef(courseId).get();
  return snap.exists ? toCourse(snap.id, snap.data()!) : null;
}

/** 그룹과 내 역할. 멤버가 아니면 null */
export async function getCourseAccess(courseId: string, uid: string): Promise<{ course: Course; role: CourseRole } | null> {
  if (!courseId || courseId.includes("/")) return null;
  const [c, m] = await db().getAll(courseRef(courseId), memberRef(courseId, uid));
  if (!c.exists || !m.exists) return null;
  return { course: toCourse(c.id, c.data()!), role: m.data()!.role as CourseRole };
}

export type MyCourse = Course & { role: CourseRole };

export async function listMyCourses(uid: string): Promise<MyCourse[]> {
  const ships = await db().collection("users").doc(uid).collection("memberships").get();
  if (ships.empty) return [];
  const refs = ships.docs.map((d) => courseRef(d.id));
  const snaps = await db().getAll(...refs);
  const roles = new Map(ships.docs.map((d) => [d.id, d.data().role as CourseRole]));
  return snaps
    .filter((s) => s.exists)
    .map((s) => ({ ...toCourse(s.id, s.data()!), role: roles.get(s.id)! }))
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

export async function updateCourse(courseId: string, input: CourseInput) {
  await courseRef(courseId).update({ ...input, updatedAt: FieldValue.serverTimestamp() });
}

/** 초대 링크 재발급 (이전 링크는 즉시 무효) */
export async function rotateInvite(courseId: string, by: string, days: InviteExpiryDays): Promise<string> {
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(courseRef(courseId));
    if (!snap.exists) throw new Error("course not found");
    const prev = (snap.data()!.currentInvite as { token: string } | null)?.token ?? null;
    return issueInvite(tx, courseId, by, days, prev);
  });
}

/** 초대 링크 끄기 (새 링크를 발급할 때까지 참여 불가) */
export async function disableInvite(courseId: string) {
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(courseRef(courseId));
    if (!snap.exists) return;
    const prev = (snap.data()!.currentInvite as { token: string } | null)?.token ?? null;
    if (prev) tx.set(inviteRef(prev), { revokedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.update(courseRef(courseId), { currentInvite: null, updatedAt: FieldValue.serverTimestamp() });
  });
}

async function readInvite(token: string, read: (r: DocumentReference) => Promise<FirebaseFirestore.DocumentSnapshot>) {
  const inv = await read(inviteRef(token));
  if (!inv.exists) return { status: "not_found" as InviteStatus, course: null };
  const courseId = inv.data()!.courseId as string;
  const c = await read(courseRef(courseId));
  const course = c.exists ? c.data()! : null;
  const status = inviteStatus(
    token,
    { courseId, revokedAt: ms(inv.data()!.revokedAt), expiresAt: ms(inv.data()!.expiresAt) },
    course ? { archivedAt: ms(course.archivedAt), currentToken: (course.currentInvite as { token: string } | null)?.token ?? null } : null,
    Date.now(),
  );
  return { status, course: course ? toCourse(courseId, course) : null };
}

/** 참여 화면용 미리보기 */
export async function previewInvite(token: string) {
  return readInvite(token, (r) => r.get());
}

export type JoinResult =
  | { ok: true; courseId: string; already: boolean }
  | { ok: false; status: Exclude<InviteStatus, "ok"> | "not_student" };

/** 초대 링크로 학생 참여. 이미 멤버면 그대로 성공 처리 */
export async function joinByInvite(token: string, student: Person): Promise<JoinResult> {
  // 트랜잭션은 학생별 문서에만 쓴다. 공유 문서(초대·그룹)는 읽기만 해서 여러 학생이 동시에 참여해도 서로 막지 않는다.
  const result = await db().runTransaction(async (tx): Promise<JoinResult> => {
    const { status, course } = await readInvite(token, (r) => tx.get(r));
    if (status !== "ok" || !course) return { ok: false, status: status === "ok" ? "not_found" : status };
    // 계정 유형은 트랜잭션 안에서 다시 확인한다. 아래에서 사용자 문서에도 쓰기 때문에
    // 동시에 진행 중인 계정 유형 변경(data/users.saveProfileGuarded)과 반드시 직렬화된다.
    const [existing, user] = await tx.getAll(memberRef(course.id, student.uid), userRef(student.uid));
    if (existing.exists) return { ok: true, courseId: course.id, already: true };
    if (user.data()?.accountType !== "student") return { ok: false, status: "not_student" };
    tx.set(userRef(student.uid), { membershipsUpdatedAt: FieldValue.serverTimestamp() }, { merge: true });
    addMember(tx, course.id, student, "student");
    return { ok: true, courseId: course.id, already: false };
  });
  if (result.ok && !result.already) {
    // 사용 횟수는 통계용이라 트랜잭션 밖에서 원자적으로 증가시킨다
    await inviteRef(token).update({ usedCount: FieldValue.increment(1) }).catch(() => {});
  }
  return result;
}

export async function listMembers(courseId: string): Promise<Member[]> {
  const snap = await courseRef(courseId).collection("members").get();
  return snap.docs
    .map((d) => toMember(d.data()))
    .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name, "ko") : a.role === "owner" ? -1 : 1));
}

export async function countStudents(courseId: string): Promise<number> {
  const agg = await courseRef(courseId).collection("members").where("role", "==", "student").count().get();
  return agg.data().count;
}

/** 학생 제외(교수자) 또는 나가기(학생 본인). 교수자 본인은 제외할 수 없다 */
export async function removeStudent(courseId: string, uid: string): Promise<"removed" | "not_member" | "is_owner"> {
  return db().runTransaction(async (tx) => {
    const m = await tx.get(memberRef(courseId, uid));
    if (!m.exists) return "not_member";
    if (m.data()!.role === "owner") return "is_owner";
    // 이후 단계(M3): 이 학생의 예정된 예약도 함께 취소한다
    tx.delete(memberRef(courseId, uid));
    tx.delete(membershipRef(uid, courseId));
    return "removed";
  });
}

/** 운영 중이거나 참여 중인 그룹이 하나라도 있는지 */
export async function hasAnyMembership(uid: string): Promise<boolean> {
  const q = await db().collection("users").doc(uid).collection("memberships").limit(1).get();
  return !q.empty;
}

/** 프로필 변경을 참여 중인 그룹의 멤버 사본(이름·학번)과 운영 그룹의 개설자 이름에 반영 */
export async function syncMemberProfile(uid: string, name: string, studentNo: string | null) {
  const ships = await db().collection("users").doc(uid).collection("memberships").get();
  if (ships.empty) return;
  const batch = db().batch();
  for (const s of ships.docs) {
    const role = s.data().role as CourseRole;
    batch.update(memberRef(s.id, uid), { name, studentNo: role === "student" ? studentNo : null });
    if (role === "owner") batch.update(courseRef(s.id), { ownerName: name });
  }
  await batch.commit();
}
