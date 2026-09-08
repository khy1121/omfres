"use client";

import { Icon } from "@iconify/react";
import { useCallback, useMemo, useState } from "react";
import AdminCalendar, { PROF_STYLE } from "./AdminCalendar";
import { btnDanger, btnPrimary, btnSecondary, Card, ErrorBox, Field, inputCls, StepHeader } from "./ui";
import { PROFESSORS } from "@/lib/config";
import { fmtDate, fmtRange, profName } from "@/lib/format";
import type { Reservation } from "@/lib/store";

type Tab = "all" | "student" | "pin";

const pinInputCls = `${inputCls} text-center text-xl tracking-[0.5em] font-mono`;

type Props = { initialAuthed: boolean; initialRows: Reservation[]; today: string };

export default function AdminPanel({ initialAuthed, initialRows, today }: Props) {
  const [authed, setAuthed] = useState(initialAuthed);
  const [tab, setTab] = useState<Tab>("all");

  // 로그인
  const [pin, setPin] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 목록
  const [rows, setRows] = useState<Reservation[]>(initialRows);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [studentQuery, setStudentQuery] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [profFilter, setProfFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

  // PIN 변경
  const [curPin, setCurPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newPin2, setNewPin2] = useState("");
  const [pinMsg, setPinMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const res = await fetch("/api/admin/reservations", { cache: "no-store" });
      if (res.status === 401) {
        setAuthed(false);
        return;
      }
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setRows(j.reservations ?? []);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "불러오기에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    setLoginError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setPin("");
      setAuthed(true);
      await load();
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "로그인에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthed(false);
    setRows([]);
    setTab("all");
  };

  const remove = async (id: string) => {
    setBusy(true);
    setListError(null);
    try {
      const res = await fetch(`/api/admin/reservations/${id}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setConfirmId(null);
      await load();
    } catch (e) {
      setListError(e instanceof Error ? e.message : "삭제에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const changePin = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    setPinMsg(null);
    if (newPin !== newPin2) {
      setPinMsg({ ok: false, text: "새 PIN이 서로 일치하지 않습니다." });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPin: curPin, newPin }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setCurPin("");
      setNewPin("");
      setNewPin2("");
      setPinMsg({ ok: true, text: "PIN이 변경되었습니다." });
    } catch (err) {
      setPinMsg({ ok: false, text: err instanceof Error ? err.message : "변경에 실패했습니다." });
    } finally {
      setBusy(false);
    }
  };

  // 학생별 그룹
  const byStudent = useMemo(() => {
    const m = new Map<string, { name: string; items: Reservation[] }>();
    for (const r of rows) {
      const g = m.get(r.name) ?? { name: r.name, items: [] };
      g.items.push(r);
      m.set(r.name, g);
    }
    const q = studentQuery.trim();
    return [...m.entries()]
      .filter(([, g]) => !q || g.name.includes(q))
      .sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows, studentQuery]);

  const filtered = rows.filter((r) => profFilter === "all" || r.professorId === profFilter);
  const visible = filtered.filter((r) => showPast || r.date >= today);
  const upcomingCount = filtered.filter((r) => r.date >= today).length;

  const digitsOnly = (v: string) => v.replace(/\D/g, "").slice(0, 6);

  if (!authed) {
    return (
      <div className="mx-auto w-full max-w-sm">
        <Card>
          <form onSubmit={login}>
            <StepHeader title="관리자 로그인" />
            <Field label="PIN (6자리)" icon="lucide:lock">
              <input
                value={pin}
                onChange={(e) => setPin(digitsOnly(e.target.value))}
                inputMode="numeric"
                type="password"
                autoComplete="off"
                placeholder="••••••"
                required
                minLength={6}
                maxLength={6}
                className={pinInputCls}
                autoFocus
              />
            </Field>
            {loginError && <ErrorBox>{loginError}</ErrorBox>}
            <button type="submit" disabled={busy || pin.length !== 6} className={`${btnPrimary} w-full`}>
              <Icon icon={busy ? "lucide:loader-2" : "lucide:log-in"} width={18} className={busy ? "animate-spin" : ""} />
              로그인
            </button>
          </form>
        </Card>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "all", label: "전체 예약", icon: "lucide:list" },
    { key: "student", label: "학생별", icon: "lucide:users" },
    { key: "pin", label: "PIN 변경", icon: "lucide:key-round" },
  ];

  const Row = ({ r, showStudent }: { r: Reservation; showStudent: boolean }) => {
    const past = r.date < today;
    return (
      <li className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${past ? "border-neutral-100 text-neutral-400" : "border-neutral-200"}`}>
        <div className="min-w-0 flex-1">
          <div className="text-sm">
            <span className="font-medium">{profName(r.professorId)}</span>
            <span className="mx-1 text-neutral-300">|</span>
            {fmtDate(r.date)} <span className="mx-1 text-neutral-300">|</span>
            <span className="font-semibold">
              {fmtRange(r.professorId, r.time)}
            </span>
          </div>
          {showStudent && (
            <div className="mt-0.5 text-sm text-neutral-600">
              {r.name}
            </div>
          )}
        </div>
        {confirmId === r.id ? (
          <div className="flex gap-1">
            <button type="button" onClick={() => setConfirmId(null)} className={`${btnSecondary} px-3 py-1.5`}>
              아니오
            </button>
            <button type="button" disabled={busy} onClick={() => remove(r.id)} className={`${btnPrimary} px-3 py-1.5`}>
              삭제
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmId(r.id)}
            className="rounded-lg p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900"
            aria-label="예약 삭제"
          >
            <Icon icon="lucide:trash-2" width={18} />
          </button>
        )}
      </li>
    );
  };

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-lg border border-neutral-200 bg-white p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={[
                "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition",
                tab === t.key ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100",
              ].join(" ")}
            >
              <Icon icon={t.icon} width={15} />
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <button type="button" onClick={load} className={`${btnSecondary} px-3 py-1.5`} aria-label="새로고침">
            <Icon icon="lucide:refresh-cw" width={16} className={loading ? "animate-spin" : ""} />
          </button>
          <button type="button" onClick={logout} className={`${btnSecondary} whitespace-nowrap px-3 py-1.5`}>
            <Icon icon="lucide:log-out" width={16} />
            로그아웃
          </button>
        </div>
      </div>

      <Card>
        {listError && <ErrorBox>{listError}</ErrorBox>}

        {tab === "all" && (
          <>
            <div className="mb-4 flex flex-wrap gap-1">
              {[{ id: "all", name: "전체" }, ...PROFESSORS].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProfFilter(p.id)}
                  className={[
                    "flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-sm transition",
                    profFilter === p.id ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 text-neutral-600 hover:border-neutral-900",
                  ].join(" ")}
                >
                  {p.id !== "all" && <span className={`inline-block h-2.5 w-2.5 rounded-sm border ${PROF_STYLE[p.id] ?? ""}`} />}
                  {p.name}
                </button>
              ))}
            </div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold tracking-tight">
                {profFilter === "all" ? "전체 예약" : profName(profFilter)}{" "}
                <span className="ml-1 text-sm font-normal text-neutral-500">예정 {upcomingCount}건 / 총 {filtered.length}건</span>
              </h2>
              <div className="flex items-center gap-3">
                {viewMode === "list" && (
                  <label className="flex items-center gap-1.5 text-sm text-neutral-600">
                    <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} className="accent-neutral-900" />
                    지난 예약 표시
                  </label>
                )}
                <div className="flex rounded-lg border border-neutral-300 p-0.5" role="group" aria-label="보기 방식">
                  {(
                    [
                      { key: "list", icon: "lucide:list", label: "목록" },
                      { key: "calendar", icon: "lucide:calendar-days", label: "캘린더" },
                    ] as const
                  ).map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => setViewMode(v.key)}
                      className={[
                        "flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1 text-sm transition",
                        viewMode === v.key ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100",
                      ].join(" ")}
                      aria-pressed={viewMode === v.key}
                    >
                      <Icon icon={v.icon} width={15} />
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {loading && rows.length === 0 ? (
              <p className="py-10 text-center text-sm text-neutral-500">불러오는 중</p>
            ) : viewMode === "calendar" ? (
              <AdminCalendar rows={filtered} today={today} profFilter={profFilter} busy={busy} onDelete={remove} />
            ) : visible.length === 0 ? (
              <p className="py-10 text-center text-sm text-neutral-500">예약이 없습니다.</p>
            ) : (
              <ul className="space-y-2">
                {visible.map((r) => (
                  <Row key={r.id} r={r} showStudent />
                ))}
              </ul>
            )}
          </>
        )}

        {tab === "student" && (
          <>
            <h2 className="mb-3 text-lg font-bold tracking-tight">학생별 예약</h2>
            <div className="relative mb-4">
              <Icon icon="lucide:search" width={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-neutral-400" />
              <input
                value={studentQuery}
                onChange={(e) => setStudentQuery(e.target.value)}
                placeholder="이름 검색"
                className={`${inputCls} pl-9`}
              />
            </div>
            {byStudent.length === 0 ? (
              <p className="py-10 text-center text-sm text-neutral-500">해당하는 학생이 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {byStudent.map(([sid, g]) => {
                  const items = g.items.filter((r) => showPast || r.date >= today);
                  return (
                    <details key={sid} open={byStudent.length <= 5 || !!studentQuery} className="rounded-xl border border-neutral-200">
                      <summary className="flex cursor-pointer items-center justify-between px-4 py-3">
                        <span className="flex items-center gap-2 font-semibold">
                          <Icon icon="lucide:user" width={16} />
                          {g.name}
                        </span>
                        <span className="text-sm text-neutral-500">{g.items.length}건</span>
                      </summary>
                      <ul className="space-y-2 px-4 pb-4">
                        {(showPast ? g.items : items).map((r) => (
                          <Row key={r.id} r={r} showStudent={false} />
                        ))}
                        {!showPast && items.length === 0 && <li className="text-sm text-neutral-400">예정된 예약 없음</li>}
                      </ul>
                    </details>
                  );
                })}
              </div>
            )}
            <label className="mt-4 flex items-center gap-1.5 text-sm text-neutral-600">
              <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} className="accent-neutral-900" />
              지난 예약 표시
            </label>
          </>
        )}

        {tab === "pin" && (
          <form onSubmit={changePin} className="mx-auto max-w-sm">
            <h2 className="mb-1 text-lg font-bold tracking-tight">PIN 변경</h2>
            <p className="mb-5 text-sm text-neutral-500">변경하면 다른 기기의 로그인은 모두 해제됩니다.</p>
            <Field label="현재 PIN" icon="lucide:lock">
              <input value={curPin} onChange={(e) => setCurPin(digitsOnly(e.target.value))} type="password" inputMode="numeric" autoComplete="off" required maxLength={6} className={pinInputCls} />
            </Field>
            <Field label="새 PIN" icon="lucide:key-round">
              <input value={newPin} onChange={(e) => setNewPin(digitsOnly(e.target.value))} type="password" inputMode="numeric" autoComplete="off" required maxLength={6} className={pinInputCls} />
            </Field>
            <Field label="새 PIN 확인" icon="lucide:key-round">
              <input value={newPin2} onChange={(e) => setNewPin2(digitsOnly(e.target.value))} type="password" inputMode="numeric" autoComplete="off" required maxLength={6} className={pinInputCls} />
            </Field>
            {pinMsg && (
              pinMsg.ok ? (
                <div className="mb-4 flex items-center gap-2 rounded-lg bg-neutral-900 p-3 text-sm text-white">
                  <Icon icon="lucide:check-circle" width={18} />
                  {pinMsg.text}
                </div>
              ) : (
                <ErrorBox>{pinMsg.text}</ErrorBox>
              )
            )}
            <button
              type="submit"
              disabled={busy || curPin.length !== 6 || newPin.length !== 6 || newPin2.length !== 6}
              className={`${btnDanger} w-full`}
            >
              <Icon icon="lucide:save" width={16} />
              PIN 변경
            </button>
          </form>
        )}
      </Card>
    </div>
  );
}
