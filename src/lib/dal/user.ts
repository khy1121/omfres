import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../firebase/admin";
import { readSession, type SessionClaims } from "../session";
import { instructorDomains, isInstructorEligible } from "../auth/instructor";
import { isInstructorProfile, isProfileComplete, type AccountType, type ProfileInput } from "../profile";
import { syncMemberProfile } from "../data/courses";
import { syncStudentOnUpcomingBookings } from "../data/bookings";

// 사용자 데이터 접근 계층. 화면·API는 Firestore를 직접 읽지 않고 이 함수들을 사용한다.

export type Viewer = {
  uid: string;
  email: string | null;
  name: string;
  studentNo: string | null;
  /** 본인이 선택한 계정 유형. 아직 선택하지 않았으면 null */
  accountType: AccountType | null;
  /** 교수를 선택할 수 있는 학교 계정인지 */
  instructorEligible: boolean;
  /** 교수 권한(그룹 생성)이 있는지 = 교수 선택 + 학교 계정 */
  isInstructor: boolean;
  /** 계정 유형과 유형별 필수 항목을 모두 입력했는지 */
  profileComplete: boolean;
};

type UserDoc = { email: string | null; name: string; studentNo: string | null; accountType?: AccountType | null };

const users = () => db().collection("users");

function toViewer(claims: SessionClaims, doc: Partial<UserDoc> | undefined): Viewer {
  const profile = { name: doc?.name ?? "", studentNo: doc?.studentNo ?? null, accountType: doc?.accountType ?? null };
  const instructorEligible = isInstructorEligible(claims.email, claims.emailVerified, instructorDomains());
  return {
    uid: claims.uid,
    email: claims.email,
    ...profile,
    instructorEligible,
    isInstructor: isInstructorProfile(profile, instructorEligible),
    profileComplete: isProfileComplete(profile, instructorEligible),
  };
}

/** 현재 요청의 로그인 사용자. 로그인하지 않았으면 null. 한 번의 렌더 안에서는 결과를 재사용한다 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const claims = await readSession();
  if (!claims) return null;
  const snap = await users().doc(claims.uid).get();
  return toViewer(claims, snap.data() as UserDoc | undefined);
});

/** 로그인이 필요한 화면에서 사용. 비로그인이면 로그인 후 현재 경로로 돌아오게 한다 */
export async function requireViewer(nextPath: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return viewer;
}

/** 로그인 직후 사용자 문서를 만든다. 이미 있으면 이메일만 최신으로 맞추고 이름·학번은 건드리지 않는다 */
export async function ensureUserDoc(claims: SessionClaims, displayName: string | null) {
  const ref = users().doc(claims.uid);
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      tx.update(ref, { email: claims.email, lastLoginAt: FieldValue.serverTimestamp() });
    } else {
      tx.set(ref, {
        email: claims.email,
        name: (displayName ?? "").trim().slice(0, 20),
        studentNo: null,
        accountType: null,
        createdAt: FieldValue.serverTimestamp(),
        lastLoginAt: FieldValue.serverTimestamp(),
      });
    }
  });
}

export async function updateProfile(uid: string, input: ProfileInput) {
  await users().doc(uid).set(
    { accountType: input.accountType, name: input.name, studentNo: input.studentNo, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
  await syncMemberProfile(uid, input.name, input.studentNo);
  // 교수가 보는 예약 현황·CSV에 바뀐 이름·학번이 나오도록 앞으로 있을 예약의 사본도 갱신
  if (input.accountType === "student") await syncStudentOnUpcomingBookings(uid, input.name, input.studentNo);
}
