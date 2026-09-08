"use client";

import { Icon } from "@iconify/react";
import type { ReactNode } from "react";

export const inputCls =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40";

export const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 transition hover:border-neutral-900 disabled:cursor-not-allowed disabled:opacity-40";

export const btnDanger =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-900 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-40";

export function BackButton({ onClick, label = "뒤로" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
    >
      <Icon icon="lucide:arrow-left" width={16} />
      {label}
    </button>
  );
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 flex items-start gap-2 rounded-lg border border-neutral-900 bg-neutral-50 p-3 text-sm text-neutral-900">
      <Icon icon="lucide:alert-circle" width={18} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-neutral-200 bg-white p-6 ${className}`}>{children}</div>;
}

export function StepHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <div className="mb-5 flex items-center justify-between">
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
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
