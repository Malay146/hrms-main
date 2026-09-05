"use client";

import { RecoverPanel } from "@/components/system/recover-panel";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  if (error.digest) {
    console.error(error.digest);
  }
  return <RecoverPanel reset={reset} />;
}
