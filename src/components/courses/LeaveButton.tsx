"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { callApi } from "@/components/api";
import { btnDanger, btnSecondary, ErrorBox } from "@/components/ui";

export default function LeaveButton({ courseId, uid }: { courseId: string; uid: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const leave = async () => {
    setBusy(true);
    setError(null);
    const r = await callApi(`/api/courses/${courseId}/members/${uid}`, "DELETE");
    if (!r.ok) {
      setError(r.error);
      setBusy(false);
      return;
    }
    router.replace("/courses");
    router.refresh();
  };

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={`${btnSecondary} text-neutral-600`}>
        그룹 나가기
      </button>
    );
  }
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
      {error && <ErrorBox>{error}</ErrorBox>}
      <p className="mb-2">이 수업 그룹에서 나갈까요? 다시 참여하려면 초대 링크가 필요합니다.</p>
      <div className="flex gap-2">
        <button type="button" onClick={leave} disabled={busy} className={btnDanger}>나가기</button>
        <button type="button" onClick={() => setConfirming(false)} disabled={busy} className={btnSecondary}>취소</button>
      </div>
    </div>
  );
}
