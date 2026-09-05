"use client";

import Sidebar from "@/components/layout/sidebar";
import Navbar from "@/components/layout/navbar";

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-screen bg-background text-text-primary overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <Navbar />
        <main className="flex-1 overflow-y-auto px-6 pt-[72px] pb-4">
          {children}
        </main>
      </div>
    </div>
  );
}
