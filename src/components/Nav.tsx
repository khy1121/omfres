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
      <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 whitespace-nowrap font-bold tracking-tight">
          <Icon icon="lucide:message-square-text" width={20} />
          상담 예약
        </Link>
        <div className="flex gap-1">
          {links.map((l) => {
            const active = path === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={[
                  "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm transition sm:px-3",
                  active ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
                ].join(" ")}
              >
                <Icon icon={l.icon} width={16} />
                {l.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
