import { redirect } from "next/navigation";
import LoginButton from "@/components/auth/LoginButton";
import { Card } from "@/components/ui";
import { getViewer } from "@/lib/dal/user";
import { safeNextPath } from "@/lib/safe-redirect";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNextPath((await searchParams).next, "/me");
  if (await getViewer()) redirect(next);

  return (
    <main className="px-4 py-8">
      <div className="mx-auto max-w-md">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">로그인</h1>
          <p className="mt-1 text-sm text-neutral-500">Google 계정으로 로그인합니다.</p>
        </header>
        <Card>
          <LoginButton next={next} />
          <ul className="mt-5 space-y-1.5 text-sm text-neutral-600">
            <li>· 첫 로그인 후 교수·학생 중 계정 유형을 선택합니다.</li>
            <li>· 교수는 학교 계정(hansung.ac.kr, hansung.kr)으로 로그인해야 선택할 수 있습니다.</li>
            <li>· 학생은 어떤 Google 계정이든 사용할 수 있으며, 이름과 학번을 입력합니다.</li>
          </ul>
        </Card>
      </div>
    </main>
  );
}
