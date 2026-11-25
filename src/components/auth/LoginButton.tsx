"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { clientAuth } from "@/lib/firebase/client";
import { btnPrimary, ErrorBox } from "@/components/ui";

const CANCELLED = new Set(["auth/popup-closed-by-user", "auth/cancelled-popup-request"]);

export default function LoginButton({ next }: { next: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async () => {
    setBusy(true);
    setError(null);
    try {
      const auth = await clientAuth();
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const { user } = await signInWithPopup(auth, provider);
      const idToken = await user.getIdToken();
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, displayName: user.displayName }),
      });
      // 로그인 상태는 서버 쿠키로 유지하므로 브라우저 쪽 로그인은 바로 정리한다
      await signOut(auth).catch(() => {});
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "로그인에 실패했습니다.");
      }
      router.replace(next);
      router.refresh();
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code && CANCELLED.has(code)) setError(null);
      else if (code === "auth/popup-blocked") setError("팝업이 차단되었습니다. 브라우저에서 팝업을 허용한 뒤 다시 시도해주세요.");
      else setError(e instanceof Error && !code ? e.message : "로그인에 실패했습니다. 잠시 후 다시 시도해주세요.");
      setBusy(false);
    }
  };

  return (
    <div>
      {error && <ErrorBox>{error}</ErrorBox>}
      <button type="button" onClick={login} disabled={busy} className={`${btnPrimary} w-full`}>
        <Icon icon={busy ? "lucide:loader-2" : "logos:google-icon"} width={18} className={busy ? "animate-spin" : ""} />
        {busy ? "로그인 중…" : "Google로 로그인"}
      </button>
    </div>
  );
}
