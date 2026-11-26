import { Icon } from "@iconify/react";
import Link from "next/link";

// 맞는 시간이 없을 때의 다음 경로: 교수 메일, 같은 그룹의 다른 일정

export type NoFitHelpProps = {
  courseId: string;
  courseTitle: string;
  scheduleTitle: string;
  instructorName: string;
  instructorEmail: string | null;
  others: { id: string; title: string }[];
};

export function mailtoHref(p: Pick<NoFitHelpProps, "instructorEmail" | "courseTitle" | "scheduleTitle">): string | null {
  if (!p.instructorEmail) return null;
  const subject = `[${p.courseTitle}] ${p.scheduleTitle} 상담 시간 문의`;
  return `mailto:${p.instructorEmail}?subject=${encodeURIComponent(subject)}`;
}

export default function NoFitHelp(p: NoFitHelpProps) {
  const mail = mailtoHref(p);
  if (!mail && !p.others.length) return null;
  return (
    <section aria-labelledby="nofit-heading" className="rounded-lg bg-white p-4 ring-1 ring-neutral-200">
      <h2 id="nofit-heading" className="mb-1 font-bold tracking-tight">맞는 시간이 없나요?</h2>
      <p className="mb-3 text-sm text-neutral-600">다른 상담 일정을 확인하거나 교수님께 직접 문의하세요.</p>
      {p.others.length > 0 && (
        <ul className="mb-3 space-y-1.5">
          {p.others.map((o) => (
            <li key={o.id}>
              <Link href={`/courses/${p.courseId}/schedules/${o.id}`} className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium hover:bg-neutral-100">
                <Icon icon="lucide:calendar-days" width={16} className="shrink-0" />
                <span className="min-w-0 flex-1 break-words">{o.title}</span>
                <Icon icon="lucide:chevron-right" width={16} className="shrink-0 text-neutral-400" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {mail && (
        <a href={mail} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium underline-offset-2 hover:underline">
          <Icon icon="lucide:mail" width={16} />
          {p.instructorName} 교수님께 메일 보내기
        </a>
      )}
    </section>
  );
}
