import type { Role } from "@/lib/shared/types";

export type EmployeeImportRow = {
  fullName: string;
  email: string;
  role: Role;
  department: string;
  jobTitle: string;
  phone?: string;
  rowNumber: number;
};

const ROLE_ALIASES: Record<string, Role> = {
  employee: "employee",
  admin: "admin",
  administrator: "admin",
  hr_manager: "hr_manager",
  "hr manager": "hr_manager",
  hrmanager: "hr_manager",
  hr_payroll_user: "hr_payroll_user",
  "hr payroll user": "hr_payroll_user",
  payroll_user: "hr_payroll_user",
  "payroll user": "hr_payroll_user",
  hr_payroll_manager: "hr_payroll_manager",
  "hr payroll manager": "hr_payroll_manager",
  payroll_manager: "hr_payroll_manager",
  "payroll manager": "hr_payroll_manager",
};

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function cellString(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return String(value).trim();
}

function pickField(
  row: Record<string, unknown>,
  aliases: string[],
): string {
  const map = new Map<string, unknown>();
  for (const [key, value] of Object.entries(row)) {
    map.set(normalizeHeader(key), value);
  }
  for (const alias of aliases) {
    if (map.has(alias)) return cellString(map.get(alias));
  }
  return "";
}

function parseRole(raw: string): Role {
  if (!raw) return "employee";
  const key = raw.trim().toLowerCase().replace(/[\s-]+/g, "_").replace(/__+/g, "_");
  const spaced = raw.trim().toLowerCase();
  return ROLE_ALIASES[key] ?? ROLE_ALIASES[spaced] ?? "employee";
}

/** Map a sheet.js AOA/object row set into validated import candidates (no Zod yet). */
export function mapSheetRowsToEmployeeImports(
  records: Record<string, unknown>[],
): { rows: EmployeeImportRow[]; errors: string[] } {
  const rows: EmployeeImportRow[] = [];
  const errors: string[] = [];

  records.forEach((record, index) => {
    const rowNumber = index + 2; // header is row 1
    const fullName = pickField(record, [
      "full_name",
      "fullname",
      "name",
      "employee_name",
      "employee",
    ]);
    const email = pickField(record, ["email", "work_email", "e_mail", "mail"]);
    const department = pickField(record, [
      "department",
      "dept",
      "team",
      "org_unit",
      "organization_unit",
    ]);
    const jobTitle = pickField(record, [
      "job_title",
      "title",
      "designation",
      "position",
      "role_title",
    ]);
    const phone = pickField(record, ["phone", "mobile", "phone_number", "contact"]);
    const roleRaw = pickField(record, ["role", "user_role", "access_role"]);

    if (!fullName && !email && !department && !jobTitle) return;

    if (!fullName || !email || !department || !jobTitle) {
      errors.push(
        `Row ${rowNumber}: needs full name, email, department, and job title.`,
      );
      return;
    }

    rows.push({
      fullName,
      email,
      role: parseRole(roleRaw),
      department,
      jobTitle,
      phone: phone || undefined,
      rowNumber,
    });
  });

  return { rows, errors };
}
