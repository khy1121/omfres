import { notFound } from "next/navigation";
import MemberList from "@/components/courses/MemberList";
import { BackLink } from "@/components/courses/BackLink";
import { requireViewer } from "@/lib/dal/user";
import { getCourseAccess, listMembers } from "@/lib/data/courses";

export const dynamic = "force-dynamic";

export default async function MembersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireViewer(`/courses/${id}/members`);
  const access = await getCourseAccess(id, viewer.uid);
  // 학생에게는 다른 학생 명단을 보여주지 않는다
  if (!access || access.role !== "owner" || !viewer.isInstructor) notFound();
  const members = await listMembers(id);

  return (
    <main className="px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6">
          <BackLink href={`/courses/${id}`} label={access.course.title} />
          <h1 className="mt-2 text-2xl font-bold tracking-tight">학생 명단</h1>
        </header>
        <MemberList courseId={id} members={members} />
      </div>
    </main>
  );
}
