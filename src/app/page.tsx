import { Icon } from "@iconify/react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { btnPrimary } from "@/components/styles";
import { getViewer } from "@/lib/dal/user";

export const dynamic = "force-dynamic";

const STEPS = [
  { icon: "lucide:users", title: "교수님이 수업 그룹을 만들고", text: "초대 링크를 학생들에게 공유합니다." },
  { icon: "lucide:calendar-clock", title: "상담 가능한 시간을 열면", text: "수업마다, 학생마다 다른 일정을 열 수 있습니다." },
  { icon: "lucide:mouse-pointer-click", title: "학생이 직접 시간을 고릅니다", text: "같은 시간은 한 명만 예약되고, 변경·취소도 직접 합니다." },
];

export default async function Home() {
  const viewer = await getViewer().catch(() => null);
  if (viewer) redirect(viewer.profileComplete ? "/courses" : "/me");

  return (
    <main className="px-4 py-12">
      <div className="mx-auto max-w-md">
        <h1 className="text-3xl font-bold tracking-tight">상담 예약</h1>
        <p className="mt-2 text-neutral-600">수업별 상담 일정을 열고, 학생이 직접 시간을 골라 예약합니다.</p>
        <ol className="mt-8 space-y-4">
          {STEPS.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-white">
                <Icon icon={s.icon} width={20} />
              </span>
              <div>
                <div className="font-semibold">{s.title}</div>
                <div className="text-sm text-neutral-600">{s.text}</div>
              </div>
            </li>
          ))}
        </ol>
        <Link href="/login" className={`${btnPrimary} mt-10 w-full`}>Google로 시작하기</Link>
        <p className="mt-3 text-center text-xs text-neutral-500">교수는 학교 계정(hansung.ac.kr, hansung.kr)으로 로그인해주세요.</p>
      </div>
    </main>
  );
}
