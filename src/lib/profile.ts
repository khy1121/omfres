import { z } from "zod";

// 프로필 입력 규칙
// - 계정 유형(교수/학생)은 본인이 선택한다. 교수는 학교 도메인 계정만 선택할 수 있다.
// - 학생은 이름·학번 필수, 교수는 이름만 필수.

export const NAME_MIN = 2;
export const NAME_MAX = 20;

export type AccountType = "student" | "instructor";

const name = z
  .string({ error: "이름을 입력해주세요." })
  .trim()
  .min(NAME_MIN, `이름은 ${NAME_MIN}자 이상 입력해주세요.`)
  .max(NAME_MAX, `이름은 ${NAME_MAX}자 이하로 입력해주세요.`);

const studentNo = z
  .string({ error: "학번을 입력해주세요." })
  .trim()
  .regex(/^\d{5,12}$/, "학번은 숫자 5~12자리로 입력해주세요.");

export type ProfileInput = { accountType: AccountType; name: string; studentNo: string | null };

/**
 * @param instructorEligible 학교 도메인의 확인된 이메일인지 (교수 선택 가능 여부)
 */
export function parseProfileInput(input: unknown, instructorEligible: boolean): { data: ProfileInput } | { error: string } {
  const raw = (input ?? {}) as { accountType?: unknown; name?: unknown; studentNo?: unknown };

  if (raw.accountType !== "student" && raw.accountType !== "instructor") return { error: "교수인지 학생인지 선택해주세요." };
  if (raw.accountType === "instructor" && !instructorEligible) {
    return { error: "교수는 학교 계정(hansung.ac.kr, hansung.kr)으로 로그인한 경우에만 선택할 수 있습니다." };
  }

  const parsedName = name.safeParse(raw.name);
  if (!parsedName.success) return { error: parsedName.error.issues[0].message };

  if (raw.accountType === "instructor") {
    // 교수는 학번을 저장하지 않는다
    return { data: { accountType: "instructor", name: parsedName.data, studentNo: null } };
  }
  const parsedNo = studentNo.safeParse(typeof raw.studentNo === "string" ? raw.studentNo : undefined);
  if (!parsedNo.success) return { error: parsedNo.error.issues[0].message };
  return { data: { accountType: "student", name: parsedName.data, studentNo: parsedNo.data } };
}

type StoredProfile = { accountType?: AccountType | null; name?: string | null; studentNo?: string | null };

/** 저장된 프로필이 현재 자격 기준으로 유효한 교수 계정인지. 도메인 자격은 매 요청 다시 확인한다 */
export function isInstructorProfile(p: StoredProfile, instructorEligible: boolean): boolean {
  return p.accountType === "instructor" && instructorEligible;
}

/** 프로필 입력을 마쳤는지 (유형 선택 + 유형별 필수 항목) */
export function isProfileComplete(p: StoredProfile, instructorEligible: boolean): boolean {
  if (!p.accountType) return false;
  return "data" in parseProfileInput(p, instructorEligible);
}

/** 학생으로 그룹에 참여할 수 있을 만큼 채워졌는지 (이름·학번) */
export function isStudentProfileComplete(p: StoredProfile): boolean {
  return "data" in parseProfileInput({ ...p, accountType: "student" }, false);
}
