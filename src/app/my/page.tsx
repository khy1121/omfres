import MyReservations from "@/components/MyReservations";
import { todayKST } from "@/lib/config";

export const dynamic = "force-dynamic";

export default function MyPage() {
  // 동적 서버 페이지의 요청 시각을 클라이언트 초기 렌더와 공유한다.
  // eslint-disable-next-line react-hooks/purity
  const initialNow = Date.now();
  return (
    <main className="px-4 py-8">
      <header className="mx-auto mb-6 max-w-md">
        <h1 className="text-2xl font-bold tracking-tight">내 예약</h1>
        <p className="mt-1 text-sm text-neutral-500">예약을 확인하고 변경하거나 취소할 수 있습니다.</p>
      </header>
      <MyReservations today={todayKST()} initialNow={initialNow} />
    </main>
  );
}
