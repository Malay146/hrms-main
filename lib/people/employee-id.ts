export function orgSlugFromName(name: string) {
  const letters = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return (letters.slice(0, 4) || "ORG").padEnd(3, "X");
}

/** Pick a unique organization.slug. Collisions append 2, 3, … (ACME → ACME2). */
export function allocateOrgSlug(name: string, existingSlugs: string[]) {
  const taken = new Set(existingSlugs.map((slug) => slug.toUpperCase()));
  const base = orgSlugFromName(name);
  if (!taken.has(base)) return base;
  for (let n = 2; n < 10_000; n += 1) {
    const candidate = `${base}${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error("Could not allocate an organization slug.");
}

export function nextEmployeeId(slug: string, year: number, existingIds: string[]) {
  const prefix = `${slug}-${year}-`;
  const max = existingIds.reduce((highest, id) => {
    if (!id.startsWith(prefix)) return highest;
    const sequence = Number(id.slice(prefix.length));
    return Number.isFinite(sequence) ? Math.max(highest, sequence) : highest;
  }, 0);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

export function initialsFromName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Format: CON/YYYY/NNNN */
export function nextContractCode(year: number, existingCodes: string[]) {
  const prefix = `CON/${year}/`;
  const max = existingCodes.reduce((highest, code) => {
    if (!code.startsWith(prefix)) return highest;
    const sequence = Number(code.slice(prefix.length));
    return Number.isFinite(sequence) ? Math.max(highest, sequence) : highest;
  }, 0);
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}
