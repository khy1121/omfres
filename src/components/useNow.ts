"use client";

import { useEffect, useState } from "react";

/** SSR과 첫 렌더는 서버 시각을 공유하고, 열린 화면에서도 상태를 갱신한다. */
export function useNow(initialNow: number) {
  const [now, setNow] = useState(initialNow);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        setNow(Date.now());
        schedule();
      }, 60_000 - Date.now() % 60_000);
    };
    const refresh = () => setNow(Date.now());
    schedule();
    window.addEventListener("focus", refresh);
    return () => { clearTimeout(timer); window.removeEventListener("focus", refresh); };
  }, []);
  return now;
}
