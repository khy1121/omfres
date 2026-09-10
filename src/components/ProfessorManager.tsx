"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useProfessors } from "./ProfessorsProvider";
import { btnDanger, btnPrimary, btnSecondary, ErrorBox, Field, inputCls } from "./ui";
import { describeAvailability, Professor } from "@/lib/config";
import type { Reservation } from "@/lib/store";

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

type AvailForm = { days: number[]; start: string; end: string };
type Form = {
  name: string;
  slotMinutes: string;
  availability: AvailForm[];
  excludeDates: string;
  onlyDates: string;
  note: string;
  phone: string;
  office: string;
};

const emptyForm = (): Form => ({
  name: "",
  slotMinutes: "30",
  availability: [{ days: [], start: "09:00", end: "17:00" }],
  excludeDates: "",
  onlyDates: "",
  note: "",
  phone: "",
  office: "",
});

const toForm = (p: Professor): Form => ({
  name: p.name,
  slotMinutes: String(p.slotMinutes),
  availability: p.availability.map((a) => ({ days: [...a.days], start: a.start, end: a.end })),
  excludeDates: (p.excludeDates ?? []).join("\n"),
  onlyDates: (p.onlyDates ?? []).join("\n"),
  note: p.note ?? "",
  phone: p.phone ?? "",
  office: p.office ?? "",
});

const parseDates = (s: string) => s.split(/[\n,\s]+/).map((d) => d.trim()).filter(Boolean);

type Mode = { kind: "list" } | { kind: "create" } | { kind: "edit"; p: Professor };

const smallInput = `${inputCls} px-2 py-1.5 text-sm`;

/** 관리자 · 상담자(교수님) 프로필과 제약조건 관리 */
export default function ProfessorManager({ rows, today }: { rows: Reservation[]; today: string }) {
  const router = useRouter();
  const professors = useProfessors();
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [form, setForm] = useState<Form>(emptyForm());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const upcomingCount = (id: string) => rows.filter((r) => r.professorId === id && r.date >= today).length;

  const open = (m: Mode) => {
    setError(null);
    setNotice(null);
    setConfirmId(null);
    setForm(m.kind === "edit" ? toForm(m.p) : emptyForm());
    setMode(m);
  };

  const patch = (f: Partial<Form>) => setForm((prev) => ({ ...prev, ...f }));
  const patchAvail = (i: number, a: Partial<AvailForm>) =>
    setForm((prev) => ({ ...prev, availability: prev.availability.map((x, j) => (j === i ? { ...x, ...a } : x)) }));
  const toggleDay = (i: number, d: number) =>
    setForm((prev) => ({
      ...prev,
      availability: prev.availability.map((x, j) =>
        j === i ? { ...x, days: x.days.includes(d) ? x.days.filter((v) => v !== d) : [...x.days, d].sort() } : x,
      ),
    }));

  const request = async (url: string, method: string, body?: unknown) => {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error ?? "요청에 실패했습니다.");
    return j;
  };

  const submit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (mode.kind === "list") return;
    setBusy(true);
    setError(null);
    const payload = {
      name: form.name,
      slotMinutes: Number(form.slotMinutes),
      availability: form.availability,
      excludeDates: parseDates(form.excludeDates),
      onlyDates: parseDates(form.onlyDates),
      note: form.note,
      phone: form.phone,
      office: form.office,
    };
    try {
      if (mode.kind === "create") {
        await request("/api/admin/professors", "POST", payload);
        setNotice(`${form.name.trim()}을(를) 추가했습니다.`);
      } else {
        await request(`/api/admin/professors/${mode.p.id}`, "PUT", payload);
        setNotice(`${form.name.trim()} 정보를 저장했습니다.`);
      }
      setMode({ kind: "list" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p: Professor) => {
    setBusy(true);
    setError(null);
    try {
      await request(`/api/admin/professors/${p.id}`, "DELETE");
      setConfirmId(null);
      setNotice(`${p.name}을(를) 삭제했습니다.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  // ── 목록 ──
  if (mode.kind === "list") {
    return (
      <>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold tracking-tight">
            상담자 관리 <span className="ml-1 text-sm font-normal text-neutral-500">{professors.length}명</span>
          </h2>
          <button type="button" onClick={() => open({ kind: "create" })} className={`${btnPrimary} px-3 py-1.5`}>
            <Icon icon="lucide:plus" width={16} />
            상담자 추가
          </button>
        </div>
        {error && <ErrorBox>{error}</ErrorBox>}
        {notice && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-neutral-900 p-3 text-sm text-white">
            <Icon icon="lucide:check-circle" width={18} />
            <span className="flex-1">{notice}</span>
            <button type="button" onClick={() => setNotice(null)} className="opacity-70 hover:opacity-100" aria-label="닫기">
              <Icon icon="lucide:x" width={16} />
            </button>
          </div>
        )}
        {professors.length === 0 ? (
          <p className="py-10 text-center text-sm text-neutral-500">등록된 상담자가 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {professors.map((p) => {
              const n = upcomingCount(p.id);
              return (
                <li key={p.id} className="rounded-xl border border-neutral-200 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white">
                      <Icon icon="lucide:graduation-cap" width={20} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-sm text-neutral-600">{describeAvailability(p)}</div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-neutral-500">
                        {p.office && (
                          <span className="flex items-center gap-1">
                            <Icon icon="lucide:map-pin" width={12} />
                            {p.office}
                          </span>
                        )}
                        {p.phone && (
                          <span className="flex items-center gap-1">
                            <Icon icon="lucide:phone" width={12} />
                            {p.phone}
                          </span>
                        )}
                        {p.onlyDates && (
                          <span className="flex items-center gap-1">
                            <Icon icon="lucide:calendar-check" width={12} />
                            지정일만 {p.onlyDates.length}일
                          </span>
                        )}
                        {p.excludeDates && (
                          <span className="flex items-center gap-1">
                            <Icon icon="lucide:calendar-x" width={12} />
                            제외 {p.excludeDates.length}일
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Icon icon="lucide:list" width={12} />
                          예정 예약 {n}건
                        </span>
                      </div>
                      {p.note && <div className="mt-1 text-xs text-neutral-400">{p.note}</div>}
                    </div>
                    {confirmId === p.id ? (
                      <div className="flex shrink-0 gap-1">
                        <button type="button" onClick={() => setConfirmId(null)} className={`${btnSecondary} px-3 py-1.5`}>
                          아니오
                        </button>
                        <button type="button" disabled={busy} onClick={() => remove(p)} className={`${btnPrimary} px-3 py-1.5`}>
                          삭제
                        </button>
                      </div>
                    ) : (
                      <div className="flex shrink-0">
                        <button
                          type="button"
                          onClick={() => open({ kind: "edit", p })}
                          className="rounded-lg p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900"
                          aria-label="수정"
                          title="수정"
                        >
                          <Icon icon="lucide:pencil" width={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setNotice(null);
                            setConfirmId(p.id);
                          }}
                          className="rounded-lg p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900"
                          aria-label="삭제"
                          title="삭제"
                        >
                          <Icon icon="lucide:trash-2" width={18} />
                        </button>
                      </div>
                    )}
                  </div>
                  {confirmId === p.id && (
                    <p className="mt-2 text-xs text-neutral-600">
                      {n > 0 ? `예정된 예약 ${n}건은 삭제되지 않고 남으며, 학생 화면에서 교수님 이름 대신 ID로 표시됩니다. ` : ""}
                      정말 삭제할까요?
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </>
    );
  }

  // ── 추가 / 수정 폼 ──
  const dayUsedElsewhere = (i: number, d: number) => form.availability.some((a, j) => j !== i && a.days.includes(d));

  return (
    <form onSubmit={submit} className="mx-auto max-w-lg">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-bold tracking-tight">{mode.kind === "create" ? "상담자 추가" : `${mode.p.name} 수정`}</h2>
        <button
          type="button"
          onClick={() => setMode({ kind: "list" })}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
        >
          <Icon icon="lucide:arrow-left" width={16} />
          목록
        </button>
      </div>

      <h3 className="mb-2 text-sm font-semibold text-neutral-500">프로필</h3>
      <Field label="이름" icon="lucide:user">
        <input value={form.name} onChange={(e) => patch({ name: e.target.value })} placeholder="홍길동 교수님" required minLength={2} maxLength={30} className={inputCls} autoFocus />
      </Field>
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Field label="연구실" icon="lucide:map-pin">
          <input value={form.office} onChange={(e) => patch({ office: e.target.value })} placeholder="연구관 000호" maxLength={50} className={inputCls} />
        </Field>
        <Field label="연락처" icon="lucide:phone">
          <input value={form.phone} onChange={(e) => patch({ phone: e.target.value })} placeholder="010-0000-0000" maxLength={30} className={inputCls} />
        </Field>
      </div>
      <Field label="안내 문구 (선택, 학생에게 표시)" icon="lucide:info">
        <input value={form.note} onChange={(e) => patch({ note: e.target.value })} placeholder="비워두면 요일·시간이 자동으로 표시됩니다" maxLength={100} className={inputCls} />
      </Field>

      <h3 className="mt-6 mb-2 text-sm font-semibold text-neutral-500">제약조건</h3>
      <Field label="상담 1회 시간 (분)" icon="lucide:clock">
        <input type="number" value={form.slotMinutes} onChange={(e) => patch({ slotMinutes: e.target.value })} min={5} max={240} step={5} required className={inputCls} />
      </Field>

      <div className="mb-4">
        <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-neutral-700">
          <Icon icon="lucide:calendar-days" width={16} />
          상담 가능 요일 · 시간
        </span>
        <div className="space-y-2">
          {form.availability.map((a, i) => (
            <div key={i} className="rounded-lg border border-neutral-200 p-3">
              <div className="mb-2 flex flex-wrap gap-1">
                {DAY_NAMES.map((nm, d) => {
                  const on = a.days.includes(d);
                  const taken = dayUsedElsewhere(i, d);
                  return (
                    <button
                      key={d}
                      type="button"
                      disabled={taken}
                      onClick={() => toggleDay(i, d)}
                      className={[
                        "h-8 w-8 rounded-full border text-sm transition",
                        on ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 text-neutral-600 hover:border-neutral-900",
                        taken ? "cursor-not-allowed opacity-30" : "",
                      ].join(" ")}
                      title={taken ? "다른 시간대에 이미 선택된 요일" : undefined}
                    >
                      {nm}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <input type="time" value={a.start} step={300} onChange={(e) => patchAvail(i, { start: e.target.value })} required className={`${smallInput} w-auto`} />
                <span className="text-neutral-400">~</span>
                <input type="time" value={a.end} step={300} onChange={(e) => patchAvail(i, { end: e.target.value })} required className={`${smallInput} w-auto`} />
                {form.availability.length > 1 && (
                  <button
                    type="button"
                    onClick={() => patch({ availability: form.availability.filter((_, j) => j !== i) })}
                    className="ml-auto rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900"
                    aria-label="시간대 삭제"
                  >
                    <Icon icon="lucide:x" width={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => patch({ availability: [...form.availability, { days: [], start: "09:00", end: "17:00" }] })}
          className="mt-2 inline-flex items-center gap-1 text-sm text-neutral-600 hover:underline"
        >
          <Icon icon="lucide:plus" width={14} />
          요일별로 다른 시간대 추가
        </button>
        <p className="mt-1 text-xs text-neutral-500">예: 월·수·금은 09:00~20:00, 목은 09:00~17:00처럼 요일마다 다르게 설정할 수 있습니다.</p>
      </div>

      <div className="grid gap-x-3 sm:grid-cols-2">
        <Field label="예약 불가 날짜 (선택)" icon="lucide:calendar-x">
          <textarea value={form.excludeDates} onChange={(e) => patch({ excludeDates: e.target.value })} rows={3} placeholder={"2026-09-21\n2026-10-15"} className={`${inputCls} font-mono text-sm`} />
        </Field>
        <Field label="지정 날짜만 허용 (선택)" icon="lucide:calendar-check">
          <textarea value={form.onlyDates} onChange={(e) => patch({ onlyDates: e.target.value })} rows={3} placeholder={"2026-09-22\n2026-09-29"} className={`${inputCls} font-mono text-sm`} />
        </Field>
      </div>
      <p className="-mt-2 mb-4 text-xs text-neutral-500">
        날짜는 YYYY-MM-DD 형식으로 한 줄에 하나씩 입력합니다. 지정 날짜를 입력하면 그 날짜 중 상담 가능 요일에 해당하는 날만 예약할 수 있습니다.
      </p>

      {error && <ErrorBox>{error}</ErrorBox>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setMode({ kind: "list" })} className={`${btnSecondary} flex-1`}>
          취소
        </button>
        <button type="submit" disabled={busy} className={`${mode.kind === "edit" ? btnDanger : btnPrimary} flex-1`}>
          <Icon icon={busy ? "lucide:loader-2" : "lucide:save"} width={16} className={busy ? "animate-spin" : ""} />
          {mode.kind === "create" ? "추가" : "저장"}
        </button>
      </div>
    </form>
  );
}
