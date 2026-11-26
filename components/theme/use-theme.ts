"use client";

import { useSyncExternalStore } from "react";

/**
 * Theme lives on <html class="dark">. The root layout applies the saved choice
 * (or the OS preference) before first paint. Hydration renders the server
 * snapshot (light) first, then switches, so server and client HTML match.
 */
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function readIsDark() {
  return document.documentElement.classList.contains("dark");
}

export function setDarkMode(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  try {
    localStorage.setItem("theme", dark ? "dark" : "light");
  } catch {
    // Private mode or storage disabled: the choice lasts for this page only.
  }
  listeners.forEach((listener) => listener());
}

export function useIsDarkMode() {
  return useSyncExternalStore(subscribe, readIsDark, () => false);
}
