"use client";

import { Icon } from "@iconify/react";
import { useEffect, useRef, type ReactNode } from "react";

// 클라이언트 컴포넌트 편의를 위해 다시 내보낸다. 서버 컴포넌트는 "./styles"에서 직접 가져와야 한다.
export { btnDanger, btnPrimary, btnSecondary, inputCls, successCls } from "./styles";

export function BackButton({ onClick, label = "뒤로" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md px-2 py-1 text-sm text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
    >
      <Icon icon="lucide:arrow-left" width={16} />
      {label}
    </button>
  );
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
      <Icon icon="lucide:alert-circle" width={18} className="mt-0.5 shrink-0" />
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`min-w-0 rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6 ${className}`}>{children}</div>;
}

export function StepHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [title]);
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <h2 ref={heading} tabIndex={-1} className="text-lg font-bold tracking-tight">{title}</h2>
      {onBack && <BackButton onClick={onBack} />}
    </div>
  );
}

export function Field({ label, icon, children }: { label: string; icon: string; children: ReactNode }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-neutral-700">
        <Icon icon={icon} width={16} />
        {label}
      </span>
      {children}
    </label>
  );
}
