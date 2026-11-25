"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { callApi } from "@/components/api";
import { btnDanger, btnPrimary, btnSecondary, Card, ErrorBox, inputCls, successCls } from "@/components/ui";
import { fmtKstDate } from "@/lib/kst";

/** expired는 서버 렌더 시각 기준으로 계산해 전달한다 */
type Props = { courseId: string; invite: { token: string; expiresAt: string | null } | null; expired: boolean };

const noop = () => () => {};
const useOrigin = () => useSyncExternalStore(noop, () => window.location.origin, () => "");

export default function InviteCard({ courseId, invite, expired }: Props) {
  const router = useRouter();
  const origin = useOrigin();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [expiry, setExpiry] = useState<"" | "7" | "30">("");
  const [confirmDisable, setConfirmDisable] = useState(false);
  const link = invite && origin ? `${origin}/join/${invite.token}` : "";

  const copy = async () => {
    setError(null);
    try {
      await navigator.clipboard.writeText(link);
      setNotice("초대 링크를 복사했습니다.");
    } catch {
      setError("복사하지 못했습니다. 링크를 직접 선택해 복사해주세요.");
    }
  };

  const rotate = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    const r = await callApi("/api/courses/" + courseId + "/invite", "POST", { expiresInDays: expiry || null });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setNotice(invite ? "새 링크를 발급했습니다. 이전 링크는 더 이상 쓸 수 없습니다." : "초대 링크를 발급했습니다.");
    router.refresh();
  };

  const disable = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    const r = await callApi("/api/courses/" + courseId + "/invite", "DELETE");
    setBusy(false);
    setConfirmDisable(false);
    if (!r.ok) return setError(r.error);
    setNotice("초대 링크를 껐습니다. 새로 발급할 때까지 아무도 참여할 수 없습니다.");
    router.refresh();
  };

  return (
    <Card>
      <h2 className="mb-1 flex items-center gap-2 text-lg font-bold tracking-tight">
        <Icon icon="lucide:link" width={18} />
        초대 링크
      </h2>
      <p className="mb-4 text-sm text-neutral-500">링크를 받은 학생은 로그인 후 이름·학번을 입력하고 참여합니다.</p>
      {error && <ErrorBox>{error}</ErrorBox>}
      {notice && (
        <div role="status" className={successCls}>
          <Icon icon="lucide:check-circle" width={18} className="mt-0.5 shrink-0" />
          {notice}
        </div>
      )}

      {invite ? (
        <>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input className={`${inputCls} font-mono text-sm`} value={link} readOnly aria-label="초대 링크" onFocus={(e) => e.target.select()} />
            <button type="button" onClick={copy} disabled={!link} className={`${btnPrimary} shrink-0`}>
              <Icon icon="lucide:copy" width={16} />
              복사
            </button>
          </div>
          <p className={`mt-2 text-xs ${expired ? "font-semibold text-red-700" : "text-neutral-500"}`}>
            {invite.expiresAt ? `${fmtKstDate(invite.expiresAt)}까지 사용 가능${expired ? " — 만료됨" : ""}` : "만료 기한 없음"}
          </p>
        </>
      ) : (
        <p className="rounded-lg bg-neutral-100 p-3 text-sm text-neutral-600">초대 링크가 꺼져 있습니다. 새로 발급하면 학생이 참여할 수 있습니다.</p>
      )}

      <div className="mt-5 border-t border-neutral-200 pt-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="flex shrink-0 items-center gap-2 whitespace-nowrap text-sm text-neutral-700">
            만료
            <select className={`${inputCls} w-auto py-2`} value={expiry} onChange={(e) => setExpiry(e.target.value as "" | "7" | "30")}>
              <option value="">없음</option>
              <option value="7">7일 후</option>
              <option value="30">30일 후</option>
            </select>
          </label>
          <button type="button" onClick={rotate} disabled={busy} className={`${btnSecondary} sm:ml-auto`}>
            <Icon icon="lucide:refresh-cw" width={16} />
            {invite ? "새 링크 발급" : "링크 발급"}
          </button>
          {invite && !confirmDisable && (
            <button type="button" onClick={() => setConfirmDisable(true)} disabled={busy} className={btnDanger}>
              링크 끄기
            </button>
          )}
        </div>
        {invite && <p className="mt-2 text-xs text-neutral-500">새 링크를 발급하면 이전 링크는 바로 쓸 수 없게 됩니다. 이미 참여한 학생은 그대로 남습니다.</p>}
        {confirmDisable && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            <p className="mb-2">링크를 끄면 새로 발급할 때까지 아무도 참여할 수 없습니다. 이미 참여한 학생은 그대로 남습니다.</p>
            <div className="flex gap-2">
              <button type="button" onClick={disable} disabled={busy} className={btnDanger}>끄기</button>
              <button type="button" onClick={() => setConfirmDisable(false)} disabled={busy} className={btnSecondary}>취소</button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
