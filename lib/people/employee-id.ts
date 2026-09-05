export function orgSlugFromName(name: string) {
  const letters = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return (letters.slice(0, 4) || "ORG").padEnd(3, "X");
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
