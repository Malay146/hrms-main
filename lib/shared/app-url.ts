/**
 * The app's public origin (no trailing slash).
 *
 * Order: BETTER_AUTH_URL / NEXT_PUBLIC_APP_URL when set (custom domains, local),
 * then Vercel's system variables (production domain for the live site, the
 * deployment URL for previews), then localhost.
 */
export function appUrl(env: Record<string, string | undefined> = process.env) {
  const explicit = env.BETTER_AUTH_URL?.trim() || env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  if (env.VERCEL_ENV === "production" && env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/** Every origin a sign-in may legitimately come from on this deployment. */
export function trustedAppOrigins(env: Record<string, string | undefined> = process.env) {
  const origins = new Set<string>([appUrl(env)]);
  for (const host of [env.VERCEL_URL, env.VERCEL_BRANCH_URL, env.VERCEL_PROJECT_PRODUCTION_URL]) {
    if (host) origins.add(`https://${host}`);
  }
  return [...origins];
}
