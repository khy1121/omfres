"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "예약하기", icon: "lucide:calendar-plus" },
  { href: "/my", label: "내 예약", icon: "lucide:list" },
  { href: "/admin", label: "관리자", icon: "lucide:shield" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="sticky top-0 z-10 border-b border-neutral-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex min-h-14 max-w-2xl flex-wrap items-center justify-between gap-x-2 px-3 py-1 sm:px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 whitespace-nowrap font-bold tracking-tight">
          <Icon icon="lucide:message-square-text" width={20} className="hidden sm:block" />
          상담 예약
        </Link>
        <div className="flex gap-1">
          {links.map((l) => {
            const active = path === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 text-sm transition sm:px-3",
                  active ? "bg-neutral-900 text-white" : l.href === "/admin" ? "text-xs text-neutral-500 hover:bg-neutral-100" : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
                ].join(" ")}
              >
                <Icon icon={l.icon} width={16} className="hidden sm:block" />
                {l.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
