"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { findProfessor, Professor } from "@/lib/config";

const Ctx = createContext<Professor[]>([]);
const LookupCtx = createContext<{ name: string; setName: (name: string) => void }>({ name: "", setName: () => {} });

export function useReservationLookup() { return useContext(LookupCtx); }

/** 서버(layout)에서 읽은 교수님 목록을 클라이언트 컴포넌트 전체에 제공 */
export function ProfessorsProvider({ professors, children }: { professors: Professor[]; children: ReactNode }) {
  const [name, setName] = useState("");
  return <Ctx.Provider value={professors}><LookupCtx.Provider value={{ name, setName }}>{children}</LookupCtx.Provider></Ctx.Provider>;
}

export function useProfessors() {
  return useContext(Ctx);
}

export function useProfessor(id: string) {
  return findProfessor(useProfessors(), id);
}
