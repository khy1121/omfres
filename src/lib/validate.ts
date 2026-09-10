import { Availability, generateTimeSlots, isDateSelectable, nowTimeKST, Professor, todayKST } from "./config";
import { getStore } from "./store";

export function validateName(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s.length >= 2 && s.length <= 20 ? s : null;
}

export async function validateProfessor(v: unknown): Promise<Professor | null> {
  const list = await getStore().getProfessors();
  return list.find((p) => p.id === v) ?? null;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

function strOpt(v: unknown, max: number): string | undefined {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : undefined;
}

function dateList(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = [...new Set(v.map((d) => String(d).trim()).filter((d) => DATE_RE.test(d)))].sort();
  return out.length ? out : undefined;
}

/** 관리자가 입력한 교수님 프로필/제약조건 검증. 성공 시 정규화된 Professor, 실패 시 에러 메시지 */
export function validateProfessorInput(id: string, v: unknown): { prof: Professor } | { error: string } {
  const b = (v ?? {}) as Record<string, unknown>;
  const name = String(b.name ?? "").trim();
  if (name.length < 2 || name.length > 30) return { error: "이름은 2~30자로 입력해주세요." };
  const slotMinutes = Number(b.slotMinutes);
  if (!Number.isInteger(slotMinutes) || slotMinutes < 5 || slotMinutes > 240 || slotMinutes % 5 !== 0) {
    return { error: "상담 시간은 5~240분, 5분 단위로 입력해주세요." };
  }
  if (!Array.isArray(b.availability) || b.availability.length === 0) return { error: "상담 가능 요일과 시간을 하나 이상 추가해주세요." };
  const availability: Availability[] = [];
  const usedDays = new Set<number>();
  for (const raw of b.availability as unknown[]) {
    const a = (raw ?? {}) as Record<string, unknown>;
    const days = Array.isArray(a.days) ? [...new Set(a.days.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort() : [];
    if (days.length === 0) return { error: "각 시간대에 요일을 하나 이상 선택해주세요." };
    const start = String(a.start ?? "");
    const end = String(a.end ?? "");
    if (!TIME_RE.test(start) || !TIME_RE.test(end)) return { error: "시간은 HH:MM 형식으로 입력해주세요." };
    if (toMin(end) - toMin(start) < slotMinutes) return { error: `${start}~${end}: 종료 시각이 시작 시각보다 최소 ${slotMinutes}분 뒤여야 합니다.` };
    for (const d of days) {
      if (usedDays.has(d)) return { error: "같은 요일이 여러 시간대에 중복되어 있습니다. 요일당 하나의 시간대만 설정할 수 있습니다." };
      usedDays.add(d);
    }
    availability.push({ days, start, end });
  }
  const prof: Professor = { id, name, slotMinutes, availability };
  const excludeDates = dateList(b.excludeDates);
  const onlyDates = dateList(b.onlyDates);
  if (excludeDates) prof.excludeDates = excludeDates;
  if (onlyDates) prof.onlyDates = onlyDates;
  const note = strOpt(b.note, 100);
  const phone = strOpt(b.phone, 30);
  const office = strOpt(b.office, 50);
  if (note) prof.note = note;
  if (phone) prof.phone = phone;
  if (office) prof.office = office;
  return { prof };
}

/** 날짜/시간이 해당 교수님의 예약 가능한 슬롯인지 검사. 문제가 있으면 에러 메시지 반환 */
export function validateSlot(prof: Professor, date: unknown, time: unknown): string | null {
  const d = String(date ?? "");
  const t = String(time ?? "");
  if (!isDateSelectable(prof, d)) return "예약할 수 없는 날짜입니다.";
  if (!generateTimeSlots(prof, d).includes(t)) return "유효하지 않은 시간입니다.";
  if (d === todayKST() && t <= nowTimeKST()) return "이미 지난 시간입니다.";
  return null;
}
