import { Icon } from "@iconify/react";
import Link from "next/link";

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-md px-2 py-1 text-sm text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
    >
      <Icon icon="lucide:arrow-left" width={16} />
      {label}
    </Link>
  );
}
