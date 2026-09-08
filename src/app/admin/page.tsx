import AdminPanel from "@/components/AdminPanel";
import { isAdmin } from "@/lib/admin";
import { todayKST } from "@/lib/config";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const authed = await isAdmin();
  const rows = authed
    ? (await getStore().listAll()).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    : [];
  return (
    <main className="px-4 py-8">
      <header className="mx-auto mb-6 max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight">관리자</h1>
        <p className="mt-1 text-sm text-neutral-500">전체 상담 예약을 조회하고 관리합니다.</p>
      </header>
      <AdminPanel initialAuthed={authed} initialRows={rows} today={todayKST()} />
    </main>
  );
}
