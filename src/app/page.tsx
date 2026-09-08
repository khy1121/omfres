import BookingFlow from "@/components/BookingFlow";
import { todayKST } from "@/lib/config";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="px-4 py-8">
      <header className="mx-auto mb-6 max-w-md">
        <h1 className="text-2xl font-bold tracking-tight">상담 예약</h1>
        <p className="mt-1 text-sm text-neutral-500">교수님과 날짜, 시간을 선택한 뒤 학번과 이름을 입력해주세요.</p>
      </header>
      <BookingFlow today={todayKST()} />
    </main>
  );
}
