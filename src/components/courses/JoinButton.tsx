"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { callApi } from "@/components/api";
import { btnPrimary, ErrorBox } from "@/components/ui";

export default function JoinButton({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async () => {
    setBusy(true);
    setError(null);
    const r = await callApi<{ courseId: string }>("/api/join", "POST", { token });
    if (!r.ok) {
      setError(r.error);
      setBusy(false);
      return;
    }
    router.push(`/courses/${r.data.courseId}`);
    router.refresh();
  };

  return (
    <div>
      {error && <ErrorBox>{error}</ErrorBox>}
      <button type="button" onClick={join} disabled={busy} className={`${btnPrimary} w-full`}>
        {busy ? "참여하는 중…" : "이 수업에 참여하기"}
      </button>
    </div>
  );
}
