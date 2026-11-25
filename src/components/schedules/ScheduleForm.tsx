"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { callApi } from "@/components/api";
import DateListInput from "@/components/DateListInput";
import { btnPrimary, btnSecondary, Card, ErrorBox, Field, inputCls } from "@/components/ui";
import {
  countSlots,
  fmtDateShort,
  parseScheduleInput,
  scheduleDates,
  slotTimesForDate,
  WEEKDAY_NAMES,
} from "@/lib/schedule/rules";
import ImpactList, { type ImpactItem } from "./ImpactList";
import DateOverridesEditor from "./DateOverridesEditor";
import { draftToInput as toInput, type ScheduleDraft as Draft } from "@/lib/schedule/draft";

type Student = { uid: string; name: string; studentNo: string | null };

const SLOT_CHOICES = [10, 15, 20, 30, 40, 45, 50, 60, 90, 120];
const HOUR_CHOICES = [
  { v: "0", label: "상담 시작 전까지" },
  { v: "1", label: "1시간 전까지" },
  { v: "3", label: "3시간 전까지" },
  { v: "6", label: "6시간 전까지" },
  { v: "12", label: "12시간 전까지" },
  { v: "24", label: "하루 전까지" },
  { v: "48", label: "이틀 전까지" },
  { v: "72", label: "사흘 전까지" },
];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <Card>
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold tracking-tight">
        <Icon icon={icon} width={18} />
        {title}
      </h2>
      {children}
    </Card>
  );
}

type Props =
  | { mode: "create"; courseId: string; initial: Draft; students: Student[] }
  | { mode: "edit"; courseId: string; scheduleId: string; initial: Draft; students: Student[] };

export default function ScheduleForm(props: Props) {
  const router = useRouter();
  const uid = useId();
  const [d, setD] = useState<Draft>(props.initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studentQuery, setStudentQuery] = useState("");
  const [manualDate, setManualDate] = useState("");
  const [manualTime, setManualTime] = useState("10:00");
  const [impact, setImpact] = useState<ImpactItem[] | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  const parsed = useMemo(() => parseScheduleInput(toInput(d)), [d]);
  const preview = useMemo(() => {
    if (!("data" in parsed)) return null;
    const dates = scheduleDates(parsed.data);
    return { total: countSlots(parsed.data), dates, sample: dates.slice(0, 4).map((x) => ({ date: x, times: slotTimesForDate(parsed.data, x) })) };
  }, [parsed]);

  const base = `/api/courses/${props.courseId}/schedules`;

  const submit = async (status: "open" | "draft" | null, confirmed = false) => {
    if ("error" in parsed) return setError(parsed.error);
    setBusy(true);
    setError(null);
    if (props.mode === "create") {
      const r = await callApi<{ id: string }>(base, "POST", { schedule: parsed.data, status });
      if (!r.ok) {
        setBusy(false);
        return setError(r.error);
      }
      router.push(`/courses/${props.courseId}/schedules/${r.data.id}`);
      router.refresh();
      return;
    }
    const url = `${base}/${props.scheduleId}`;
    if (!confirmed) {
      const dry = await callApi<{ impact: ImpactItem[] }>(url, "PATCH", { schedule: parsed.data, dryRun: true });
      if (!dry.ok) {
        setBusy(false);
        return setError(dry.error);
      }
      if (dry.data.impact.length) {
        setBusy(false);
        return setImpact(dry.data.impact);
      }
    }
    const r = await callApi(url, "PATCH", { schedule: parsed.data });
    if (!r.ok) {
      setBusy(false);
      return setError(r.error);
    }
    router.push(`/courses/${props.courseId}/schedules/${props.scheduleId}`);
    router.refresh();
  };

  const toggleDay = (i: number, day: number) =>
    set(
      "windows",
      d.windows.map((w, j) => (j === i ? { ...w, days: w.days.includes(day) ? w.days.filter((x) => x !== day) : [...w.days, day] } : w)),
    );
  const setWindow = (i: number, k: "start" | "end", v: string) => set("windows", d.windows.map((w, j) => (j === i ? { ...w, [k]: v } : w)));

  const addManual = () => {
    if (!manualDate || !manualTime) return setError("추가할 날짜와 시각을 입력해주세요.");
    const key = `${manualDate} ${manualTime}`;
    if (d.manualSlots.includes(key)) return setError("이미 추가한 시간입니다.");
    setError(null);
    set("manualSlots", [...d.manualSlots, key].sort());
  };

  const filteredStudents = props.students.filter((s) => {
    const q = studentQuery.trim();
    return !q || s.name.includes(q) || (s.studentNo ?? "").includes(q);
  });

  const radio = (name: string, value: string, checked: boolean, onChange: () => void, label: string, hint?: string) => (
    <label
      className={[
        "flex min-h-11 cursor-pointer flex-col gap-0.5 rounded-lg border p-3 text-sm transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-neutral-900/30",
        checked ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white hover:border-neutral-900",
      ].join(" ")}
    >
      <input type="radio" name={`${uid}-${name}`} value={value} checked={checked} onChange={onChange} className="sr-only" />
      <span className="font-semibold">{label}</span>
      {hint && <span className={checked ? "text-neutral-200" : "text-neutral-500"}>{hint}</span>}
    </label>
  );

  return (
    <div className="space-y-4">
      <Section title="기본 정보" icon="lucide:info">
        <Field label="일정 이름" icon="lucide:tag">
          <input className={inputCls} value={d.title} onChange={(e) => set("title", e.target.value)} maxLength={50} placeholder="예: 중간고사 면담" />
        </Field>
        <Field label="학생 안내 (선택)" icon="lucide:align-left">
          <textarea className={`${inputCls} min-h-20`} value={d.description} onChange={(e) => set("description", e.target.value)} maxLength={500} placeholder="상담 목적, 준비할 내용 등" />
        </Field>
        <fieldset className="mb-4">
          <legend className="mb-1.5 text-sm font-medium text-neutral-700">상담 방식</legend>
          <div className="grid grid-cols-2 gap-2">
            {radio("mode", "offline", d.mode === "offline", () => set("mode", "offline"), "대면")}
            {radio("mode", "online", d.mode === "online", () => set("mode", "online"), "온라인")}
          </div>
        </fieldset>
        <Field label={d.mode === "offline" ? "상담 장소" : "안내 (선택, 예: Zoom 대기실 입장 후 대기)"} icon="lucide:map-pin">
          <input className={inputCls} value={d.location} onChange={(e) => set("location", e.target.value)} maxLength={100} placeholder={d.mode === "offline" ? "예: 연구관 709호" : ""} />
        </Field>
        {d.mode === "online" && (
          <Field label="온라인 상담 주소 (선택)" icon="lucide:video">
            <input className={inputCls} value={d.meetingUrl} onChange={(e) => set("meetingUrl", e.target.value)} placeholder="https://" inputMode="url" />
          </Field>
        )}
        <Field label="상담 1회 길이" icon="lucide:timer">
          <select className={inputCls} value={d.slotMinutes} onChange={(e) => set("slotMinutes", e.target.value)}>
            {[...new Set([...SLOT_CHOICES, Number(d.slotMinutes)])].sort((a, b) => a - b).map((m) => (
              <option key={m} value={m}>{m}분</option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="상담 시간" icon="lucide:calendar-clock">
        <fieldset className="mb-4">
          <legend className="sr-only">시간 정하는 방식</legend>
          <div className="grid grid-cols-2 gap-2">
            {radio("rule", "recurring", d.ruleType === "recurring", () => set("ruleType", "recurring"), "요일 반복", "기간 동안 요일별 시간대")}
            {radio("rule", "manual", d.ruleType === "manual", () => set("ruleType", "manual"), "직접 지정", "특정 날짜·시각만 열기")}
          </div>
        </fieldset>

        {d.ruleType === "recurring" ? (
          <>
            <div className="mb-4 grid grid-cols-2 gap-2">
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-neutral-700">시작일</span>
                <input type="date" className={inputCls} value={d.from} onChange={(e) => set("from", e.target.value)} />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-neutral-700">종료일</span>
                <input type="date" className={inputCls} value={d.to} min={d.from} onChange={(e) => set("to", e.target.value)} />
              </label>
            </div>
            <div className="mb-2 text-sm font-medium text-neutral-700">요일별 시간대</div>
            <ul className="mb-3 space-y-3">
              {d.windows.map((w, i) => (
                <li key={i} className="rounded-lg border border-neutral-200 p-3">
                  <div className="mb-2 flex flex-wrap gap-1" role="group" aria-label={`시간대 ${i + 1} 요일`}>
                    {DAY_ORDER.map((day) => (
                      <button
                        key={day}
                        type="button"
                        aria-pressed={w.days.includes(day)}
                        onClick={() => toggleDay(i, day)}
                        className={`min-h-10 min-w-10 rounded-lg border text-sm transition ${w.days.includes(day) ? "border-neutral-900 bg-neutral-900 font-semibold text-white" : "border-neutral-300 hover:border-neutral-900"}`}
                      >
                        {WEEKDAY_NAMES[day]}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="time" step={300} className={`${inputCls} min-w-0`} value={w.start} onChange={(e) => setWindow(i, "start", e.target.value)} aria-label={`시간대 ${i + 1} 시작`} />
                    <span className="text-neutral-500">~</span>
                    <input type="time" step={300} className={`${inputCls} min-w-0`} value={w.end} onChange={(e) => setWindow(i, "end", e.target.value)} aria-label={`시간대 ${i + 1} 종료`} />
                    {d.windows.length > 1 && (
                      <button type="button" onClick={() => set("windows", d.windows.filter((_, j) => j !== i))} className="min-h-11 min-w-11 shrink-0 rounded-lg text-neutral-500 hover:bg-neutral-100" aria-label={`시간대 ${i + 1} 삭제`}>
                        <Icon icon="lucide:x" width={18} className="mx-auto" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => set("windows", [...d.windows, { days: [], start: "14:00", end: "16:00" }])} className={`${btnSecondary} mb-4 w-full`}>
              <Icon icon="lucide:plus" width={16} />
              시간대 추가
            </button>
            <p className="-mt-2 mb-4 text-xs text-neutral-500">종료 시각은 마지막 상담이 끝나야 하는 시각입니다. 같은 요일의 시간대는 겹칠 수 없습니다.</p>
            <DateOverridesEditor
              overrides={d.overrides}
              onChange={(v) => set("overrides", v)}
              weekly={d.windows}
              from={d.from}
              to={d.to}
              excludeDates={d.excludeDates.split(/[\n,\s]+/).filter(Boolean)}
            />
            <DateListInput label="제외할 날짜 (휴강일 등)" value={d.excludeDates} onChange={(v) => set("excludeDates", v)} />
          </>
        ) : (
          <>
            <div className="mb-2 flex flex-col gap-2 sm:flex-row">
              <input type="date" className={`${inputCls} min-w-0`} value={manualDate} onChange={(e) => setManualDate(e.target.value)} aria-label="날짜" />
              <input type="time" step={300} className={`${inputCls} min-w-0`} value={manualTime} onChange={(e) => setManualTime(e.target.value)} aria-label="시작 시각" />
              <button type="button" onClick={addManual} className={`${btnSecondary} shrink-0`}>추가</button>
            </div>
            {d.manualSlots.length ? (
              <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="직접 지정한 시간">
                {d.manualSlots.map((s) => (
                  <li key={s} className="flex items-center gap-1 rounded-lg bg-neutral-100 py-1 pl-2.5 pr-1 text-sm tabular-nums">
                    {fmtDateShort(s.slice(0, 10))} {s.slice(11)}
                    <button type="button" onClick={() => set("manualSlots", d.manualSlots.filter((x) => x !== s))} className="min-h-9 min-w-9 rounded text-neutral-500 hover:bg-neutral-200" aria-label={`${s} 삭제`}>
                      <Icon icon="lucide:x" width={14} className="mx-auto" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-2 text-xs text-neutral-500">추가한 시간이 없습니다.</p>
            )}
          </>
        )}

        <div className="mt-4 rounded-lg bg-neutral-100 p-3 text-sm" aria-live="polite">
          {preview ? (
            <>
              <div className="font-semibold">
                상담 {preview.total}회 · {preview.dates.length}일
              </div>
              <ul className="mt-2 space-y-1 text-neutral-700">
                {preview.sample.map((x) => (
                  <li key={x.date} className="tabular-nums">
                    <span className="font-medium">{fmtDateShort(x.date)}</span> {x.times.slice(0, 6).join(", ")}
                    {x.times.length > 6 ? ` 외 ${x.times.length - 6}개` : ""}
                  </li>
                ))}
                {preview.dates.length > 4 && <li className="text-neutral-500">… {fmtDateShort(preview.dates[preview.dates.length - 1])}까지</li>}
              </ul>
            </>
          ) : (
            <span className="text-neutral-600">{"error" in parsed ? parsed.error : ""}</span>
          )}
        </div>
      </Section>

      <Section title="대상과 예약 규칙" icon="lucide:users">
        <fieldset className="mb-4">
          <legend className="mb-1.5 text-sm font-medium text-neutral-700">볼 수 있는 학생</legend>
          <div className="grid grid-cols-2 gap-2">
            {radio("aud", "all", d.audience === "all", () => set("audience", "all"), "그룹 전체")}
            {radio("aud", "selected", d.audience === "selected", () => set("audience", "selected"), "선택한 학생", `${d.audienceIds.length}명 선택`)}
          </div>
        </fieldset>
        {d.audience === "selected" && (
          <div className="mb-4">
            {props.students.length === 0 ? (
              <p className="rounded-lg bg-neutral-100 p-3 text-sm text-neutral-600">아직 그룹에 참여한 학생이 없습니다.</p>
            ) : (
              <>
                <input className={`${inputCls} mb-2`} value={studentQuery} onChange={(e) => setStudentQuery(e.target.value)} placeholder="이름 또는 학번 검색" aria-label="학생 검색" />
                <ul className="max-h-60 divide-y divide-neutral-100 overflow-y-auto rounded-lg border border-neutral-200">
                  {filteredStudents.map((s) => (
                    <li key={s.uid}>
                      <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-neutral-50">
                        <input
                          type="checkbox"
                          checked={d.audienceIds.includes(s.uid)}
                          onChange={(e) => set("audienceIds", e.target.checked ? [...d.audienceIds, s.uid] : d.audienceIds.filter((x) => x !== s.uid))}
                          className="size-4 accent-neutral-900"
                        />
                        <span className="font-medium">{s.name}</span>
                        <span className="tabular-nums text-neutral-500">{s.studentNo}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
        <Field label="학생 1명당 예약 가능 횟수" icon="lucide:repeat">
          <select className={inputCls} value={d.maxBookingsPerStudent} onChange={(e) => set("maxBookingsPerStudent", e.target.value)}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}회</option>)}
          </select>
        </Field>
        <Field label="예약 마감" icon="lucide:clock">
          <select className={inputCls} value={d.bookingCloseHours} onChange={(e) => set("bookingCloseHours", e.target.value)}>
            {HOUR_CHOICES.map((h) => <option key={h.v} value={h.v}>{h.label}</option>)}
          </select>
        </Field>
        <Field label="학생 변경·취소 마감" icon="lucide:calendar-x">
          <select className={inputCls} value={d.cancelCloseHours} onChange={(e) => set("cancelCloseHours", e.target.value)}>
            {HOUR_CHOICES.map((h) => <option key={h.v} value={h.v}>{h.label}</option>)}
          </select>
        </Field>
      </Section>

      {error && <ErrorBox>{error}</ErrorBox>}
      {impact ? (
        <Card>
          <ImpactList items={impact} />
          <p className="my-3 text-sm text-neutral-600">저장해도 위 예약은 자동으로 취소되지 않습니다. 필요하면 예약 현황에서 시간을 옮기거나 취소해주세요.</p>
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <button type="button" onClick={() => submit(null, true)} disabled={busy} className={`${btnPrimary} sm:flex-1`}>그래도 저장</button>
            <button type="button" onClick={() => setImpact(null)} disabled={busy} className={btnSecondary}>다시 수정</button>
          </div>
        </Card>
      ) : props.mode === "create" ? (
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <button type="button" onClick={() => submit("open")} disabled={busy} className={`${btnPrimary} sm:flex-1`}>
            <Icon icon="lucide:send" width={16} />
            학생에게 공개
          </button>
          <button type="button" onClick={() => submit("draft")} disabled={busy} className={btnSecondary}>초안으로 저장</button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <button type="button" onClick={() => submit(null)} disabled={busy} className={`${btnPrimary} sm:flex-1`}>저장</button>
          <button type="button" onClick={() => router.back()} disabled={busy} className={btnSecondary}>취소</button>
        </div>
      )}
    </div>
  );
}
