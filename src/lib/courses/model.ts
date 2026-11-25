import { z } from "zod";

// 수업 그룹·초대 링크의 순수 규칙 (DB 없이 테스트 가능)

export type CourseRole = "owner" | "student";

export const COURSE_TITLE_MAX = 50;
export const COURSE_TERM_MAX = 20;
export const COURSE_DESC_MAX = 500;
export const INVITE_EXPIRY_CHOICES = [null, 7, 30] as const;
export type InviteExpiryDays = (typeof INVITE_EXPIRY_CHOICES)[number];

const courseSchema = z.object({
  title: z
    .string({ error: "수업 이름을 입력해주세요." })
    .trim()
    .min(1, "수업 이름을 입력해주세요.")
    .max(COURSE_TITLE_MAX, `수업 이름은 ${COURSE_TITLE_MAX}자 이하로 입력해주세요.`),
  term: z
    .string({ error: "학기를 입력해주세요." })
    .trim()
    .min(1, "학기를 입력해주세요.")
    .max(COURSE_TERM_MAX, `학기는 ${COURSE_TERM_MAX}자 이하로 입력해주세요.`),
  description: z
    .string()
    .trim()
    .max(COURSE_DESC_MAX, `설명은 ${COURSE_DESC_MAX}자 이하로 입력해주세요.`)
    .optional()
    .default(""),
});

export type CourseInput = z.infer<typeof courseSchema>;

export function parseCourseInput(input: unknown): { data: CourseInput } | { error: string } {
  const r = courseSchema.safeParse(input ?? {});
  return r.success ? { data: r.data } : { error: r.error.issues[0].message };
}

export function parseInviteExpiry(v: unknown): { days: InviteExpiryDays } | { error: string } {
  if (v === null || v === undefined || v === "") return { days: null };
  const n = Number(v);
  return n === 7 || n === 30 ? { days: n } : { error: "만료 기간은 없음, 7일, 30일 중에서 선택해주세요." };
}

/** 한국 학기 기본값: 3~8월 1학기, 9~12월 2학기, 1~2월은 전년도 2학기 (KST 기준 연·월) */
export function defaultTerm(year: number, month: number): string {
  if (month >= 3 && month <= 8) return `${year}년 1학기`;
  if (month >= 9) return `${year}년 2학기`;
  return `${year - 1}년 2학기`;
}

/** 초대 토큰: 추측할 수 없는 24바이트 난수 (base64url 32자) */
export function newInviteToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

export function isInviteTokenFormat(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{32}$/.test(token);
}

export type InviteRecord = { courseId: string; revokedAt: number | null; expiresAt: number | null };
export type CourseInviteState = { archivedAt: number | null; currentToken: string | null };

export type InviteStatus = "ok" | "not_found" | "revoked" | "expired" | "archived";

/** 초대 링크로 참여할 수 있는지. 시각은 epoch ms */
export function inviteStatus(token: string, invite: InviteRecord | null, course: CourseInviteState | null, now: number): InviteStatus {
  if (!invite || !course) return "not_found";
  if (course.archivedAt !== null) return "archived";
  if (invite.revokedAt !== null || course.currentToken !== token) return "revoked";
  if (invite.expiresAt !== null && invite.expiresAt <= now) return "expired";
  return "ok";
}

export const INVITE_STATUS_MESSAGE: Record<Exclude<InviteStatus, "ok">, string> = {
  not_found: "초대 링크를 찾을 수 없습니다. 주소를 다시 확인해주세요.",
  revoked: "더 이상 사용할 수 없는 초대 링크입니다. 교수님께 새 링크를 요청해주세요.",
  expired: "만료된 초대 링크입니다. 교수님께 새 링크를 요청해주세요.",
  archived: "종료된 수업 그룹입니다.",
};
