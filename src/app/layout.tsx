import type { Metadata } from "next";
import Nav from "@/components/Nav";
import { getViewer } from "@/lib/dal/user";
import "./globals.css";

export const metadata: Metadata = {
  title: "상담 예약",
  description: "수업별 상담 일정을 열고, 학생이 직접 시간을 골라 예약합니다.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer().catch(() => null);
  return (
    <html lang="ko">
      <body className="min-h-screen bg-neutral-50 text-neutral-900 antialiased">
        <Nav viewer={viewer ? { name: viewer.name, isInstructor: viewer.isInstructor } : null} />
        {children}
      </body>
    </html>
  );
}
