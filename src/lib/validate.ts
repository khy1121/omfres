import { generateTimeSlots, isDateSelectable, nowTimeKST, Professor, todayKST } from "./config";
import { getStore } from "./store";

export function validateName(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s.length >= 2 && s.length <= 20 ? s : null;
}

export async function validateProfessor(v: unknown): Promise<Professor | null> {
  const list = await getStore().getProfessors();
  return list.find((p) => p.id === v) ?? null;
}

export { validateProfessorInput } from "./professor-input";

/** 날짜/시간이 해당 교수님의 예약 가능한 슬롯인지 검사. 문제가 있으면 에러 메시지 반환 */
export function validateSlot(prof: Professor, date: unknown, time: unknown): string | null {
  const d = String(date ?? "");
  const t = String(time ?? "");
  if (!isDateSelectable(prof, d)) return "예약할 수 없는 날짜입니다.";
  if (!generateTimeSlots(prof, d).includes(t)) return "유효하지 않은 시간입니다.";
  if (d === todayKST() && t <= nowTimeKST()) return "이미 지난 시간입니다.";
  return null;
}
