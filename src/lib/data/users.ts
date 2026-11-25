import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../firebase/admin";
import type { ProfileInput } from "../profile";

// 사용자 문서 쓰기. 계정 유형 변경과 그룹 참여가 동시에 일어나도 어긋나지 않도록 트랜잭션으로 처리한다.
// 그룹 참여 트랜잭션(courses.joinByInvite)도 같은 사용자 문서에 쓰므로, 둘이 겹치면 Firestore가 한쪽을
// 다시 실행하고, 다시 실행된 쪽은 상대의 결과(바뀐 유형 / 새 멤버십)를 보고 거부한다.

export const userRef = (uid: string) => db().collection("users").doc(uid);

export type SaveProfileResult = "saved" | "has_membership";

/** 프로필 저장. 그룹이 하나라도 있으면 계정 유형 변경은 거부한다 */
export async function saveProfileGuarded(uid: string, input: ProfileInput): Promise<SaveProfileResult> {
  const ref = userRef(uid);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = (snap.data()?.accountType ?? null) as ProfileInput["accountType"] | null;
    if (current && current !== input.accountType) {
      const ships = await tx.get(ref.collection("memberships").limit(1));
      if (!ships.empty) return "has_membership";
    }
    tx.set(
      ref,
      { accountType: input.accountType, name: input.name, studentNo: input.studentNo, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    return "saved";
  });
}
