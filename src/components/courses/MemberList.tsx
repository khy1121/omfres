"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { callApi } from "@/components/api";
import { btnDanger, btnSecondary, ErrorBox, inputCls, successCls } from "@/components/ui";
import { fmtKstDate } from "@/lib/kst";
import { fmtDateShort } from "@/lib/schedule/rules";
import type { Member } from "@/lib/data/courses";

export default function MemberList({ courseId, members }: { courseId: string; members: Member[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const students = members.filter((m) => m.role === "student");
  const shown = useMemo(() => {
    const q = query.trim();
    return q ? students.filter((m) => m.name.includes(q) || (m.studentNo ?? "").includes(q)) : students;
  }, [students, query]);

  const remove = async (m: Member) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    const r = await callApi<{ cancelled: number; failed: { date: string; time: string }[] }>(`/api/courses/${courseId}/members/${m.uid}`, "DELETE");
    setBusy(false);
    setConfirming(null);
    if (!r.ok) return setError(r.error);
    const { cancelled = 0, failed = [] } = r.data;
    setNotice(`${m.name} 학생을 그룹에서 제외했습니다.${cancelled ? ` 예정된 상담 ${cancelled}건을 취소했습니다.` : ""}`);
    if (failed.length) {
      setError(
        `예정된 상담 ${failed.length}건(${failed.map((f) => `${fmtDateShort(f.date)} ${f.time}`).join(", ")})은 취소하지 못했습니다. 해당 일정의 예약 현황에서 직접 취소해주세요.`,
      );
    }
    router.refresh();
  };

  return (
    <div>
      {error && <ErrorBox>{error}</ErrorBox>}
      {notice && (
        <div role="status" className={successCls}>
          <Icon icon="lucide:check-circle" width={18} className="mt-0.5 shrink-0" />
          {notice}
        </div>
      )}
      <div className="mb-3 flex items-center gap-2">
        <input className={inputCls} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="이름 또는 학번 검색" aria-label="학생 검색" />
        <span className="shrink-0 text-sm text-neutral-500">{shown.length}명</span>
      </div>
      {students.length === 0 ? (
        <p className="rounded-lg bg-neutral-100 p-4 text-sm text-neutral-600">아직 참여한 학생이 없습니다. 초대 링크를 학생들에게 공유해주세요.</p>
      ) : shown.length === 0 ? (
        <p className="rounded-lg bg-neutral-100 p-4 text-sm text-neutral-600">검색 결과가 없습니다.</p>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
          {shown.map((m) => (
            <li key={m.uid} className="p-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-semibold">{m.name}</span>
                <span className="tabular-nums text-sm text-neutral-600">{m.studentNo}</span>
                <span className="min-w-0 break-all text-xs text-neutral-500">{m.email}</span>
                <span className="text-xs text-neutral-400">{fmtKstDate(m.joinedAt)} 참여</span>
                {confirming !== m.uid && (
                  <button type="button" onClick={() => setConfirming(m.uid)} disabled={busy} className={`${btnSecondary} ml-auto min-h-9 px-3 py-1.5 text-xs`}>
                    제외
                  </button>
                )}
              </div>
              {confirming === m.uid && (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-900">
                  <span className="mr-auto">{m.name} 학생을 제외할까요? 초대 링크로 다시 참여할 수 있습니다.</span>
                  <button type="button" onClick={() => remove(m)} disabled={busy} className={`${btnDanger} min-h-9 px-3 py-1.5 text-xs`}>제외</button>
                  <button type="button" onClick={() => setConfirming(null)} disabled={busy} className={`${btnSecondary} min-h-9 px-3 py-1.5 text-xs`}>취소</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
