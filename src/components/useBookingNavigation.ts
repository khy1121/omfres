"use client";

import { useEffect, useRef, useState } from "react";

type Position = { step: 1 | 2 | 3 | 4; stage: "date" | "time"; depth: number };
const start: Position = { step: 1, stage: "date", depth: 0 };

/** 방문 기록에는 화면 위치만 저장한다. 이름·예약 내용은 URL에 노출하지 않는다. */
export function useBookingNavigation() {
  const [position, setPosition] = useState<Position>(start);
  const session = useRef("");
  const completed = useRef(false);
  const blocked = useRef(false);

  useEffect(() => {
    session.current = crypto.randomUUID();
    window.history.replaceState({ ...window.history.state, booking: { ...start, session: session.current } }, "");
  }, []);

  useEffect(() => {
    const pop = (event: PopStateEvent) => {
      const entry = event.state?.booking;
      if (blocked.current || completed.current) {
        // 이전 항목을 덮어쓰지 않고 원래 방문 기록 위치로 복귀한다.
        if (entry?.session === session.current) {
          const delta = position.depth - entry.depth;
          if (delta !== 0) window.history.go(delta);
        }
        return;
      }
      if (entry?.session === session.current) setPosition({ step: entry.step, stage: entry.stage, depth: entry.depth });
      else {
        setPosition(start);
        window.history.replaceState({ ...window.history.state, booking: { ...start, session: session.current } }, "");
      }
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, [position]);

  const go = (step: Position["step"], stage: Position["stage"] = "date", replace = false) => {
    const next = { step, stage, depth: position.depth + (replace ? 0 : 1) };
    window.history[replace ? "replaceState" : "pushState"]({ ...window.history.state, booking: { ...next, session: session.current } }, "");
    setPosition(next);
  };
  const back = (fallback: Position["step"], stage: Position["stage"] = "date") => {
    if (blocked.current) return;
    if (position.depth > 0) window.history.back();
    else go(fallback, stage, true);
  };
  const finish = () => { completed.current = true; go(4, "date", true); };
  const reset = () => {
    completed.current = false;
    session.current = crypto.randomUUID();
    window.history.replaceState({ ...window.history.state, booking: { ...start, session: session.current } }, "");
    setPosition(start);
  };
  return { ...position, go, back, finish, reset, setBlocked: (value: boolean) => { blocked.current = value; } };
}
