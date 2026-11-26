"use client";

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  // Omitted unless set: the browser uses the page's own origin, which is right
  // for localhost, previews, and production alike.
  baseURL: process.env.NEXT_PUBLIC_APP_URL || undefined,
});
