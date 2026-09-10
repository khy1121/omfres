"use client";

import { createContext, useContext, type ReactNode } from "react";
import { findProfessor, Professor } from "@/lib/config";

const Ctx = createContext<Professor[]>([]);

/** 서버(layout)에서 읽은 교수님 목록을 클라이언트 컴포넌트 전체에 제공 */
export function ProfessorsProvider({ professors, children }: { professors: Professor[]; children: ReactNode }) {
  return <Ctx.Provider value={professors}>{children}</Ctx.Provider>;
}

export function useProfessors() {
  return useContext(Ctx);
}

export function useProfessor(id: string) {
  return findProfessor(useProfessors(), id);
}
