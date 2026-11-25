import type { Metadata } from "next";
import Nav from "@/components/Nav";
import { ProfessorsProvider } from "@/components/ProfessorsProvider";
import { getStore } from "@/lib/store";
import { getViewer } from "@/lib/dal/user";
import "./globals.css";

export const metadata: Metadata = {
  title: "상담 예약",
  description: "상담 날짜와 시간을 선택해 예약하세요.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [professors, viewer] = await Promise.all([getStore().getProfessors(), getViewer().catch(() => null)]);
  return (
    <html lang="ko">
      <body className="min-h-screen bg-neutral-50 text-neutral-900 antialiased">
        <ProfessorsProvider professors={professors}>
          <Nav viewer={viewer ? { name: viewer.name } : null} />
          {children}
        </ProfessorsProvider>
      </body>
    </html>
  );
}
