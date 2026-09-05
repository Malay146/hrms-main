"use client";

import { createContext, useContext } from "react";
import type { SessionUser } from "@/lib/shared/types";

const SessionContext = createContext<SessionUser | null>(null);

export function SessionProvider({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

export function useSessionUser() {
  const user = useContext(SessionContext);
  if (!user) {
    throw new Error("useSessionUser must be used inside SessionProvider");
  }
  return user;
}
