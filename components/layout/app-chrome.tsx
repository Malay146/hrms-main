"use client";

import Sidebar from "@/components/layout/sidebar";
import Navbar from "@/components/layout/navbar";
import { SessionProvider } from "@/components/providers/session-context";
import { CopilotWidget } from "@/components/ai/copilot-widget";
import { hasPermission } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/shared/types";

export function AppChrome({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  return (
    <SessionProvider user={user}>
      <div className="flex h-screen w-screen bg-background text-text-primary overflow-hidden font-sans">
        <Sidebar />
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
          <Navbar />
          <main className="flex-1 overflow-y-auto px-6 pt-[72px] pb-4">
            {children}
          </main>
          {hasPermission(user.role, "viewAiAnalytics") ? <CopilotWidget /> : null}
        </div>
      </div>
    </SessionProvider>
  );
}
