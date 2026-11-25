// 에뮬레이터 테스트용 사용자 준비. guard.ts 다음에 불러온다.
import { db } from "../../src/lib/firebase/admin";
import { joinByInvite } from "../../src/lib/data/courses";

type Person = { uid: string; name: string; email: string | null; studentNo: string | null };

/** 학생 계정 사용자 문서를 만든다 (실제 앱에서는 로그인 후 내 정보 저장 시 생성됨) */
export async function seedStudent(p: Person) {
  await db().collection("users").doc(p.uid).set({ accountType: "student", name: p.name, studentNo: p.studentNo, email: p.email }, { merge: true });
}

/** 학생 계정으로 만든 뒤 초대 링크로 참여 */
export async function joinAsStudent(token: string, p: Person) {
  await seedStudent(p);
  return joinByInvite(token, p);
}
