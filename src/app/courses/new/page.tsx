import Link from "next/link";
import CourseForm from "@/components/courses/CourseForm";
import { btnPrimary } from "@/components/styles";
import { Card } from "@/components/ui";
import { requireViewer } from "@/lib/dal/user";
import { defaultTerm } from "@/lib/courses/model";
import { kstYearMonth } from "@/lib/kst";

export const dynamic = "force-dynamic";

export default async function NewCoursePage() {
  const viewer = await requireViewer("/courses/new");
  const { year, month } = kstYearMonth();

  return (
    <main className="px-4 py-8">
      <div className="mx-auto max-w-md">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">새 수업 그룹</h1>
          <p className="mt-1 text-sm text-neutral-500">만들면 학생 초대 링크가 바로 발급됩니다.</p>
        </header>
        <Card>
          {viewer.isInstructor && viewer.profileComplete ? (
            <CourseForm mode="create" initial={{ title: "", term: defaultTerm(year, month), description: "" }} />
          ) : (
            <>
              <p className="mb-4 text-sm text-neutral-600">
                {viewer.isInstructor
                  ? "내 정보에서 이름을 먼저 입력해주세요."
                  : "수업 그룹은 교수 계정만 만들 수 있습니다. 학교 계정으로 로그인한 뒤 내 정보에서 계정 유형을 교수로 선택해주세요."}
              </p>
              <Link href="/me?next=/courses/new" className={`${btnPrimary} w-full`}>내 정보로 이동</Link>
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
