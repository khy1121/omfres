"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { btnPrimary, btnSecondary, Card, ErrorBox, Field, inputCls, successCls } from "@/components/ui";
import { NAME_MAX, type AccountType } from "@/lib/profile";

type Props = {
  initial: { accountType: AccountType | null; name: string; studentNo: string };
  email: string | null;
  instructorEligible: boolean;
  /** 저장 후 돌아갈 경로 (예: 초대 링크 참여 화면) */
  next?: string | null;
};

const TYPES: { value: AccountType; label: string; icon: string; hint: string }[] = [
  { value: "student", label: "학생", icon: "lucide:backpack", hint: "초대 링크로 수업에 참여해 상담을 예약합니다." },
  { value: "instructor", label: "교수", icon: "lucide:graduation-cap", hint: "수업 그룹을 만들고 상담 일정을 엽니다." },
];

export default function ProfileForm({ initial, email, instructorEligible, next }: Props) {
  const router = useRouter();
  const [accountType, setAccountType] = useState<AccountType | null>(initial.accountType);
  const [name, setName] = useState(initial.name);
  const [studentNo, setStudentNo] = useState(initial.studentNo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!accountType) {
      setError("교수인지 학생인지 선택해주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountType, name, studentNo: accountType === "student" ? studentNo : "" }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string; name?: string; studentNo?: string | null } | null;
      if (!res.ok) throw new Error(data?.error ?? "저장하지 못했습니다.");
      setName(data?.name ?? name);
      setStudentNo(data?.studentNo ?? "");
      if (next) {
        router.push(next);
        router.refresh();
        return;
      }
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장하지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    setBusy(true);
    await fetch("/api/session", { method: "DELETE" }).catch(() => {});
    router.replace("/login");
    router.refresh();
  };

  return (
    <Card>
      <form onSubmit={save}>
        <div className="mb-5 flex items-center gap-2 rounded-lg bg-neutral-100 p-3 text-sm">
          <Icon icon="lucide:mail" width={16} className="shrink-0 text-neutral-500" />
          <span className="min-w-0 break-all">{email ?? "이메일 없음"}</span>
        </div>
        {error && <ErrorBox>{error}</ErrorBox>}
        {saved && (
          <div role="status" className={successCls}>
            <Icon icon="lucide:check-circle" width={18} className="mt-0.5 shrink-0" />
            저장했습니다.
          </div>
        )}

        <fieldset className="mb-5">
          <legend className="mb-1.5 text-sm font-medium text-neutral-700">계정 유형</legend>
          <div className="grid grid-cols-2 gap-2">
            {TYPES.map((t) => {
              const disabled = t.value === "instructor" && !instructorEligible;
              const selected = accountType === t.value;
              return (
                <label
                  key={t.value}
                  className={[
                    "flex min-h-11 cursor-pointer flex-col gap-1 rounded-lg border p-3 text-sm transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-neutral-900/30",
                    selected ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white hover:border-neutral-900",
                    disabled ? "cursor-not-allowed opacity-40 hover:border-neutral-300" : "",
                  ].join(" ")}
                >
                  <input
                    type="radio"
                    name="accountType"
                    value={t.value}
                    checked={selected}
                    disabled={disabled}
                    onChange={() => setAccountType(t.value)}
                    className="sr-only"
                  />
                  <span className="flex items-center gap-1.5 font-semibold">
                    <Icon icon={t.icon} width={16} />
                    {t.label}
                  </span>
                  <span className={selected ? "text-neutral-200" : "text-neutral-500"}>{t.hint}</span>
                </label>
              );
            })}
          </div>
          {!instructorEligible && (
            <p className="mt-2 text-xs text-neutral-500">교수는 학교 계정(hansung.ac.kr, hansung.kr)으로 로그인한 경우에만 선택할 수 있습니다.</p>
          )}
        </fieldset>

        <Field label="이름" icon="lucide:user">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={NAME_MAX} autoComplete="name" required />
        </Field>
        {accountType === "student" && (
          <Field label="학번" icon="lucide:id-card">
            <input
              className={inputCls}
              value={studentNo}
              onChange={(e) => setStudentNo(e.target.value)}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={12}
              required
            />
          </Field>
        )}
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <button type="submit" disabled={busy || !accountType} className={`${btnPrimary} sm:flex-1`}>저장</button>
          <button type="button" onClick={logout} disabled={busy} className={btnSecondary}>
            <Icon icon="lucide:log-out" width={16} />
            로그아웃
          </button>
        </div>
      </form>
    </Card>
  );
}
