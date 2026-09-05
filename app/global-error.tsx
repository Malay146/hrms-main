"use client";

import { RecoverPanel } from "@/components/system/recover-panel";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  if (error.digest) {
    console.error(error.digest);
  }

  return (
    <html lang="en">
      <body className="bg-background">
        <RecoverPanel reset={reset} />
      </body>
    </html>
  );
}
