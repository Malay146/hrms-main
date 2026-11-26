/**
 * Next sequential code for a prefix, e.g. CAN001 → CAN002.
 * Uses the highest existing number (not the row count), so deleted rows never
 * cause a duplicate code.
 */
export function nextSequentialCode(prefix: string, existing: string[], width = 3) {
  const max = existing.reduce((highest, code) => {
    if (!code.startsWith(prefix)) return highest;
    const n = Number(code.slice(prefix.length));
    return Number.isInteger(n) ? Math.max(highest, n) : highest;
  }, 0);
  return `${prefix}${String(max + 1).padStart(width, "0")}`;
}

export const CANDIDATE_SOURCES = [
  "LinkedIn",
  "Referrals",
  "Career Portal",
  "Indeed",
  "Agency",
  "Other",
] as const;
