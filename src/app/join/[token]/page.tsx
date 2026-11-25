import { Icon } from "@iconify/react";
import Link from "next/link";
import JoinButton from "@/components/courses/JoinButton";
import { btnPrimary, btnSecondary, Card } from "@/components/ui";
import { requireViewer } from "@/lib/dal/user";
import { getCourseAccess, previewInvite } from "@/lib/data/courses";
import { INVITE_STATUS_MESSAGE, isInviteTokenFormat } from "@/lib/courses/model";

export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="px-4 py-8">
      <div className="mx-auto max-w-md">
        <h1 className="mb-6 text-2xl font-bold tracking-tight">수업 참여</h1>
        <Card>{children}</Card>
      </div>
    </main>
  );
}

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const path = `/join/${encodeURIComponent(token)}`;
  const viewer = await requireViewer(path);

  const preview = isInviteTokenFormat(token) ? await previewInvite(token) : { status: "not_found" as const, course: null };
  const course = preview.course;

  // 이미 멤버면(교수자 본인 포함) 링크 상태와 상관없이 그룹으로 안내
  if (course) {
    const access = await getCourseAccess(course.id, viewer.uid);
    if (access) {
      return (
        <Shell>
          <p className="mb-4 text-sm text-neutral-600">이미 <b>{course.title}</b> 그룹에 {access.role === "owner" ? "교수자로 있습니다" : "참여해 있습니다"}.</p>
          <Link href={`/courses/${course.id}`} className={`${btnPrimary} w-full`}>그룹으로 이동</Link>
        </Shell>
      );
    }
  }

  if (preview.status !== "ok" || !course) {
    return (
      <Shell>
        <p className="flex items-start gap-2 text-sm text-neutral-700">
          <Icon icon="lucide:link-2-off" width={18} className="mt-0.5 shrink-0" />
          {INVITE_STATUS_MESSAGE[preview.status === "ok" ? "not_found" : preview.status]}
        </p>
      </Shell>
    );
  }

  const info = (
    <div className="mb-5 rounded-lg bg-neutral-100 p-4 text-sm">
      <div className="text-lg font-bold">{course.title}</div>
      <div className="mt-1 text-neutral-600">{course.term}</div>
      <div className="mt-3 flex items-center gap-1.5 text-neutral-800">
        <Icon icon="lucide:graduation-cap" width={16} className="shrink-0" />
        <span>
          {course.ownerName} 교수 <span className="break-all text-neutral-500">({course.ownerEmail})</span>
        </span>
      </div>
      {course.description && <p className="mt-3 whitespace-pre-wrap text-neutral-700">{course.description}</p>}
    </div>
  );

  if (viewer.accountType === "instructor") {
    return (
      <Shell>
        {info}
        <p className="text-sm text-neutral-600">교수 계정은 학생으로 참여할 수 없습니다. 학생 계정으로 로그인해주세요.</p>
      </Shell>
    );
  }

  if (!viewer.profileComplete) {
    return (
      <Shell>
        {info}
        <p className="mb-4 text-sm text-neutral-600">참여하려면 내 정보에서 학생을 선택하고 이름과 학번을 입력해주세요.</p>
        <Link href={`/me?next=${encodeURIComponent(path)}`} className={`${btnPrimary} w-full`}>내 정보 입력하기</Link>
      </Shell>
    );
  }

  return (
    <Shell>
      {info}
      <p className="mb-4 text-sm text-neutral-600">
        <b>{viewer.name}</b> ({viewer.studentNo}) 이름으로 참여합니다. 교수님이 명단에서 이름·학번·이메일을 확인합니다.
      </p>
      <JoinButton token={token} />
      <Link href="/me" className={`${btnSecondary} mt-2 w-full`}>내 정보 수정</Link>
    </Shell>
  );
}
