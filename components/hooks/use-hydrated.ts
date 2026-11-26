"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * false during server render and hydration, true afterwards. Use it to gate
 * browser-only UI (charts, portals) without a setState-in-effect "mounted" flag.
 */
export function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
