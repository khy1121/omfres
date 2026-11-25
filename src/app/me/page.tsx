import ProfileForm from "@/components/auth/ProfileForm";
import { requireViewer } from "@/lib/dal/user";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const viewer = await requireViewer("/me");
  const description = !viewer.profileComplete
    ? "처음 오셨네요. 계정 유형과 이름을 입력해주세요. 학생은 학번도 필요합니다."
    : viewer.isInstructor
      ? "교수 계정입니다. 수업 그룹을 만들 수 있습니다."
      : "학생 계정입니다. 초대 링크로 수업에 참여할 수 있습니다.";
  return (
    <main className="px-4 py-8">
      <div className="mx-auto max-w-md">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">내 정보</h1>
          <p className="mt-1 text-sm text-neutral-500">{description}</p>
        </header>
        <ProfileForm
          initial={{ accountType: viewer.accountType, name: viewer.name, studentNo: viewer.studentNo ?? "" }}
          email={viewer.email}
          instructorEligible={viewer.instructorEligible}
        />
      </div>
    </main>
  );
}
