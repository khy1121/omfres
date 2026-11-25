import { Icon } from "@iconify/react";
import Link from "next/link";
import { btnPrimary, Card } from "@/components/ui";
import { requireViewer } from "@/lib/dal/user";
import { listMyCourses, type MyCourse } from "@/lib/data/courses";

export const dynamic = "force-dynamic";

function CourseCard({ c }: { c: MyCourse }) {
  return (
    <li>
      <Link
        href={`/courses/${c.id}`}
        className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4 transition hover:border-neutral-900"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{c.title}</div>
          <div className="mt-0.5 text-sm text-neutral-500">
            {c.term}
            {c.role === "student" && c.ownerName ? ` · ${c.ownerName} 교수` : ""}
          </div>
        </div>
        <Icon icon="lucide:chevron-right" width={18} className="shrink-0 text-neutral-400" />
      </Link>
    </li>
  );
}

export default async function CoursesPage() {
  const viewer = await requireViewer("/courses");

  if (!viewer.profileComplete) {
    return (
      <main className="px-4 py-8">
        <div className="mx-auto max-w-md">
          <h1 className="mb-6 text-2xl font-bold tracking-tight">내 수업</h1>
          <Card>
            <p className="mb-4 text-sm text-neutral-600">수업 그룹을 이용하려면 먼저 계정 유형과 이름{viewer.accountType === "instructor" ? "" : "·학번"}을 입력해주세요.</p>
            <Link href="/me?next=/courses" className={`${btnPrimary} w-full`}>내 정보 입력하기</Link>
          </Card>
        </div>
      </main>
    );
  }

  const all = await listMyCourses(viewer.uid);
  const owned = all.filter((c) => c.role === "owner");
  const joined = all.filter((c) => c.role === "student");

  return (
    <main className="px-4 py-8">
      <div className="mx-auto max-w-md">
        <header className="mb-6 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">내 수업</h1>
            <p className="mt-1 text-sm text-neutral-500">
              {viewer.isInstructor ? "운영 중인 수업 그룹입니다." : "참여 중인 수업 그룹입니다. 교수님께 받은 초대 링크로 참여할 수 있습니다."}
            </p>
          </div>
          {viewer.isInstructor && (
            <Link href="/courses/new" className={`${btnPrimary} shrink-0`}>
              <Icon icon="lucide:plus" width={16} />
              새 그룹
            </Link>
          )}
        </header>

        {viewer.isInstructor ? (
          owned.length ? (
            <ul className="space-y-2">{owned.map((c) => <CourseCard key={c.id} c={c} />)}</ul>
          ) : (
            <Card>
              <p className="text-sm text-neutral-600">아직 만든 수업 그룹이 없습니다. 수업마다 그룹을 만들고 초대 링크를 학생들에게 공유하세요.</p>
            </Card>
          )
        ) : joined.length ? (
          <ul className="space-y-2">{joined.map((c) => <CourseCard key={c.id} c={c} />)}</ul>
        ) : (
          <Card>
            <p className="text-sm text-neutral-600">아직 참여한 수업이 없습니다. 교수님께 받은 초대 링크를 열면 참여할 수 있습니다.</p>
          </Card>
        )}
      </div>
    </main>
  );
}
