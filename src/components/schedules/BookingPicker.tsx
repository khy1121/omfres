"use client";

import { Icon } from "@iconify/react";
import { useEffect, useRef, useState } from "react";
import Calendar from "@/components/Calendar";
import { callApi } from "@/components/api";
import { btnPrimary, btnSecondary, ErrorBox } from "@/components/ui";
import { dateUnavailableReason, fmtDateKo, fmtDateShort, scheduleRange, type AvailabilitySummary, type SlotConfig, type SlotState } from "@/lib/schedule/rules";
import type { Booking } from "@/lib/data/bookings";

type Props = {
  courseId: string;
  scheduleId: string;
  cfg: SlotConfig;
  today: string;
  /** move: 기존 예약의 시간을 바꾼다 */
  moving?: { bookingId: string; date: string; time: string } | null;
  onDone: (booking: Booking) => void;
  onCancel?: () => void;
};

type SlotsResult = { key: string; slots: SlotState[]; quota: { used: number; max: number } } | { key: string; error: string };

const REASON_LABEL: Record<NonNullable<SlotState["reason"]>, string> = {
  mine: "내 예약",
  taken: "마감",
  overlap: "내 다른 예약과 겹침",
  closed: "예약 마감 시간 지남",
};

export default function BookingPicker({ courseId, scheduleId, cfg, today, moving, onDone, onCancel }: Props) {
  const range = scheduleRange(cfg, today);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [result, setResult] = useState<SlotsResult | null>(null);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 응답을 받지 못해 결과를 모르는 상태 — 재전송 대신 결과 확인을 먼저 한다 */
  const [unknown, setUnknown] = useState(false);
  const slotsHeading = useRef<HTMLHeadingElement>(null);

  const key = date ? `${date}:${version}` : null;
  const movingId = moving?.bookingId ?? null;

  useEffect(() => {
    if (!date || !key) return;
    let alive = true;
    const q = new URLSearchParams({ date });
    if (movingId) q.set("booking", movingId);
    callApi<{ slots: SlotState[]; quota: { used: number; max: number } }>(`/api/courses/${courseId}/schedules/${scheduleId}/slots?${q}`, "GET").then((r) => {
      if (alive) setResult(r.ok ? { key, slots: r.data.slots, quota: r.data.quota } : { key, error: r.error });
    });
    return () => {
      alive = false;
    };
  }, [date, key, courseId, scheduleId, movingId]);

  // 기간 전체의 날짜별 남은 수 (달력 표시용). 실패하면 표시만 생략하고 날짜는 규칙대로 고를 수 있다.
  const [summary, setSummary] = useState<{ version: number; data: AvailabilitySummary } | null>(null);
  useEffect(() => {
    let alive = true;
    const q = movingId ? `?${new URLSearchParams({ booking: movingId })}` : "";
    callApi<AvailabilitySummary>(`/api/courses/${courseId}/schedules/${scheduleId}/availability${q}`, "GET").then((r) => {
      if (alive && r.ok && r.data && typeof r.data.days === "object" && r.data.days) setSummary({ version, data: r.data });
    });
    return () => {
      alive = false;
    };
  }, [version, courseId, scheduleId, movingId]);
  const days = summary?.data.days ?? null;

  const ruleReason = (d: string) => dateUnavailableReason(cfg, d, today);
  const isSelectable = (d: string) => ruleReason(d) === null && (!days || (days[d] ?? 0) > 0);
  const unavailableReason = (d: string) => ruleReason(d) ?? (days && !days[d] ? "마감" : null);
  const note = (d: string) => (days && days[d] ? { text: `${days[d]}개`, label: `예약 가능 시간 ${days[d]}개` } : null);

  const current = result && result.key === key ? result : null;
  const slots = current && "slots" in current ? current.slots : null;

  const pickDate = (d: string) => {
    setDate(d);
    setTime(null);
    setError(null);
    requestAnimationFrame(() => slotsHeading.current?.focus());
  };

  // 가장 빠른 예약 가능 시간 바로 선택. 다른 달이면 달력이 그 달을 보여주도록 다시 그린다.
  const next = summary?.data.next ?? null;
  const [calendarKey, setCalendarKey] = useState(0);
  const pickNext = () => {
    if (!next) return;
    setDate(next.date);
    setTime(next.time);
    setError(null);
    setCalendarKey((k) => k + 1);
    requestAnimationFrame(() => slotsHeading.current?.focus());
  };
  const nextIsSelected = !!next && next.date === date && next.time === time;

  const confirm = async () => {
    if (!date || !time) return;
    setBusy(true);
    setError(null);
    const r = moving
      ? await callApi<{ booking: Booking }>(`/api/bookings/${moving.bookingId}`, "PATCH", { date, time })
      : await callApi<{ booking: Booking }>("/api/bookings", "POST", { scheduleId, date, time });
    setBusy(false);
    if (r.ok) return onDone(r.data.booking);
    if (r.status === 0 || r.status >= 500) {
      setUnknown(true);
      setError("요청 결과를 확인하지 못했습니다. 예약이 이미 처리되었을 수 있으니 결과를 먼저 확인해주세요.");
      return;
    }
    setError(r.error);
    // 선점·겹침·마감이면 최신 상태를 다시 불러온다 (선택한 날짜는 유지)
    if (r.status === 409) {
      setTime(null);
      setVersion((v) => v + 1);
    }
  };

  const verify = async () => {
    setBusy(true);
    const r = await callApi<{ bookings: Booking[] }>(`/api/bookings?scheduleId=${scheduleId}`, "GET");
    setBusy(false);
    if (!r.ok) return setError("결과를 아직 확인하지 못했습니다. 잠시 후 다시 확인해주세요.");
    const hit = r.data.bookings.find((b) => b.status === "booked" && b.date === date && b.time === time && (!moving || b.id === moving.bookingId));
    if (hit) return onDone(hit);
    setUnknown(false);
    setError("처리된 예약이 없습니다. 선택은 그대로 두었으니 다시 확정해주세요.");
    setVersion((v) => v + 1);
  };

  if (!range) {
    return <p className="rounded-lg bg-neutral-100 p-4 text-sm text-neutral-600">앞으로 남은 상담 시간이 없습니다.</p>;
  }

  return (
    <div>
      {moving && (
        <p className="mb-4 rounded-lg bg-neutral-100 p-3 text-sm">
          현재 예약: <b className="tabular-nums">{fmtDateKo(moving.date)} {moving.time}</b>
        </p>
      )}
      {next && !unknown && (
        <button
          type="button"
          onClick={pickNext}
          disabled={busy || nextIsSelected}
          aria-label={`${moving ? "가장 빠른 변경 가능 시간" : "가장 빠른 상담"} ${fmtDateKo(next.date)} ${next.time} 선택`}
          className="mb-4 flex min-h-14 w-full items-center gap-3 rounded-xl border-[1.5px] border-neutral-900 bg-white px-3.5 py-2.5 text-left transition hover:bg-neutral-50 disabled:cursor-default disabled:border-neutral-200 disabled:hover:bg-white"
        >
          <Icon icon="lucide:zap" width={20} className="shrink-0" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-xs text-neutral-600">{moving ? "가장 빠른 변경 가능 시간" : "가장 빠른 상담"}</span>
            <span className="text-[15px] font-bold tabular-nums">
              {fmtDateShort(next.date)} {next.time}
            </span>
          </span>
          <span className="shrink-0 text-sm font-semibold">{nextIsSelected ? "선택됨" : "선택 →"}</span>
        </button>
      )}
      <Calendar
        key={calendarKey}
        selected={date}
        today={today}
        start={range.first}
        max={range.last}
        onSelect={pickDate}
        isSelectable={isSelectable}
        unavailableReason={unavailableReason}
        note={note}
      />
      {days && <p className="mt-2 text-xs text-neutral-500">날짜 아래 숫자는 지금 예약할 수 있는 시간 수입니다.</p>}

      {date && (
        <section className="mt-6" aria-labelledby="slots-heading">
          <h3 id="slots-heading" ref={slotsHeading} tabIndex={-1} className="mb-3 font-bold tracking-tight">
            {fmtDateKo(date)} 상담 시간
          </h3>
          {!current ? (
            <p className="flex items-center gap-2 text-sm text-neutral-500">
              <Icon icon="lucide:loader-2" width={16} className="animate-spin" />
              불러오는 중…
            </p>
          ) : "error" in current ? (
            <div>
              <ErrorBox>{current.error}</ErrorBox>
              <button type="button" onClick={() => setVersion((v) => v + 1)} className={btnSecondary}>다시 불러오기</button>
            </div>
          ) : (
            <>
              {!moving && current.quota.used >= current.quota.max && (
                <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">이 일정의 예약 가능 횟수({current.quota.max}회)를 모두 사용했습니다.</p>
              )}
              {slots && slots.every((s) => !s.available) && (
                <p className="mb-3 text-sm text-neutral-600">이 날은 예약할 수 있는 시간이 없습니다. 다른 날짜를 선택해주세요.</p>
              )}
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="group" aria-label="상담 시작 시간">
                {slots?.map((s) => {
                  const selected = time === s.time;
                  return (
                    <button
                      key={s.time}
                      type="button"
                      disabled={!s.available || busy || unknown}
                      aria-pressed={selected}
                      aria-label={`${s.time}~${s.end} ${s.available ? "예약 가능" : REASON_LABEL[s.reason!]}`}
                      onClick={() => { setTime(s.time); setError(null); }}
                      className={[
                        "flex min-h-14 flex-col items-center justify-center rounded-lg border px-1 py-1.5 text-sm tabular-nums transition",
                        selected
                          ? "border-neutral-900 bg-neutral-900 font-semibold text-white"
                          : s.available
                            ? "border-neutral-300 bg-white hover:border-neutral-900"
                            : "cursor-not-allowed border-neutral-100 bg-neutral-50 text-neutral-400",
                      ].join(" ")}
                    >
                      <span className={s.available ? "" : "line-through"}>{s.time}</span>
                      {!s.available && <span className="text-[10px] leading-tight no-underline">{REASON_LABEL[s.reason!]}</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </section>
      )}

      <div className="mt-6">
        {error && <ErrorBox>{error}</ErrorBox>}
        {date && time && !unknown && (
          <p className="mb-3 text-sm">
            선택: <b className="tabular-nums">{fmtDateKo(date)} {time}</b>
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          {unknown ? (
            <button type="button" onClick={verify} disabled={busy} className={`${btnPrimary} sm:flex-1`}>예약 결과 확인</button>
          ) : (
            <button type="button" onClick={confirm} disabled={!date || !time || busy} className={`${btnPrimary} sm:flex-1`}>
              {busy ? "처리 중…" : moving ? "이 시간으로 변경" : "이 시간으로 예약"}
            </button>
          )}
          {onCancel && (
            <button type="button" onClick={onCancel} disabled={busy} className={btnSecondary}>취소</button>
          )}
        </div>
      </div>
    </div>
  );
}
