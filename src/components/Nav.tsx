"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Viewer = { name: string; isInstructor: boolean } | null;

export default function Nav({ viewer }: { viewer: Viewer }) {
  const path = usePathname();
  const links = viewer
    ? [
        { href: "/courses", label: "내 수업", icon: "lucide:book-open" },
        { href: "/bookings", label: viewer.isInstructor ? "다가오는 상담" : "내 예약", icon: "lucide:calendar-check" },
        { href: "/me", label: viewer.name || "내 정보", icon: "lucide:circle-user" },
      ]
    : [{ href: "/login", label: "로그인", icon: "lucide:log-in" }];

  return (
    <nav className="sticky top-0 z-10 border-b border-neutral-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex min-h-14 max-w-2xl flex-wrap items-center justify-between gap-x-2 px-3 py-1 sm:px-4">
        <Link href={viewer ? "/courses" : "/"} className="flex shrink-0 items-center gap-2 whitespace-nowrap font-bold tracking-tight">
          <Icon icon="lucide:message-square-text" width={20} className="hidden sm:block" />
          상담 예약
        </Link>
        <div className="flex min-w-0 gap-1">
          {links.map((l) => {
            const active = path === l.href || path.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex min-h-11 min-w-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 text-sm transition sm:px-3",
                  active ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
                ].join(" ")}
              >
                <Icon icon={l.icon} width={16} className="hidden shrink-0 sm:block" />
                <span className="max-w-[7rem] truncate">{l.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
