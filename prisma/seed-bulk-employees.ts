/**
 * Deterministic bulk roster used by prisma/seed.ts and seed-more-employees.ts.
 * Diversified across departments, statuses, and employment types.
 */

export const BULK_DEPARTMENTS = [
  "Human Resources",
  "Engineering",
  "Sales",
  "Finance",
  "Product",
  "Design",
  "Marketing",
  "Operations",
  "Customer Success",
  "Legal",
  "IT Support",
  "Data Analytics",
  "Quality Assurance",
  "Procurement",
] as const;

export type BulkDepartment = (typeof BULK_DEPARTMENTS)[number];

export const BULK_TITLES: Record<BulkDepartment, string[]> = {
  "Human Resources": [
    "HR Generalist",
    "Talent Partner",
    "People Ops Specialist",
    "Recruiting Coordinator",
    "HR Business Partner",
  ],
  Engineering: [
    "Frontend Engineer",
    "Backend Engineer",
    "Full Stack Engineer",
    "QA Engineer",
    "DevOps Engineer",
    "Mobile Engineer",
    "Staff Engineer",
  ],
  Sales: [
    "Sales Executive",
    "Account Executive",
    "SDR",
    "Sales Manager",
    "Customer Success Associate",
  ],
  Finance: [
    "Payroll Specialist",
    "Financial Analyst",
    "Accountant",
    "AP Specialist",
    "Controller Associate",
  ],
  Product: ["Product Manager", "Product Analyst", "Product Owner", "Program Manager"],
  Design: ["Product Designer", "UX Designer", "UI Designer", "Design Ops"],
  Marketing: [
    "Growth Marketer",
    "Content Marketer",
    "Brand Designer",
    "Demand Gen Specialist",
  ],
  Operations: ["Ops Coordinator", "Office Manager", "Facilities Lead", "BizOps Analyst"],
  "Customer Success": [
    "CS Manager",
    "Support Specialist",
    "Onboarding Specialist",
    "Success Engineer",
  ],
  Legal: ["Legal Counsel", "Compliance Analyst", "Contract Specialist"],
  "IT Support": [
    "IT Support Specialist",
    "Systems Administrator",
    "Helpdesk Analyst",
    "Network Technician",
  ],
  "Data Analytics": [
    "Data Analyst",
    "BI Developer",
    "Analytics Engineer",
    "Reporting Specialist",
  ],
  "Quality Assurance": [
    "QA Analyst",
    "Test Engineer",
    "Automation Engineer",
    "Quality Lead",
  ],
  Procurement: [
    "Procurement Specialist",
    "Vendor Manager",
    "Buyer",
    "Sourcing Analyst",
  ],
};

const FIRST = [
  "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Ayaan", "Krishna", "Ishaan",
  "Ananya", "Aadhya", "Diya", "Myra", "Sara", "Anika", "Aarohi", "Pari", "Anvi", "Kiara",
  "Rohan", "Kabir", "Yash", "Dev", "Nikhil", "Rahul", "Amit", "Suresh", "Neha", "Pooja",
  "Priya", "Sneha", "Kavya", "Meera", "Isha", "Riya", "Tanvi", "Nisha", "Sanjay", "Vikram",
  "Harsh", "Manav", "Om", "Parth", "Rudra", "Shaurya", "Atharv", "Dhruv", "Laksh", "Ira",
  "Zara", "Nora", "Maya", "Lina", "Elena", "Sofia", "Emma", "Olivia", "Noah", "Liam",
  "Lucas", "Ethan", "Mason", "Logan", "James", "Benjamin", "Henry", "Alexander", "Sebastian", "Jack",
];

const LAST = [
  "Sharma", "Patel", "Singh", "Mehta", "Shah", "Kapoor", "Gupta", "Joshi", "Nair", "Iyer",
  "Reddy", "Rao", "Chopra", "Malhotra", "Banerjee", "Mukherjee", "Das", "Bose", "Khan", "Ali",
  "Verma", "Agarwal", "Jain", "Saxena", "Trivedi", "Desai", "Kulkarni", "Pawar", "More", "Kamble",
  "Fernandes", "D'Souza", "Rodrigues", "Pinto", "Costa", "Williams", "Johnson", "Brown", "Davis", "Miller",
  "Wilson", "Moore", "Taylor", "Anderson", "Thomas", "Jackson", "White", "Harris", "Martin", "Thompson",
];

function pick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length]!;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "");
}

export type BulkEmployeeSeed = {
  name: string;
  email: string;
  employeeId: string;
  department: BulkDepartment;
  jobTitle: string;
  phone: string;
  status: "active" | "inactive" | "on_leave";
  employeeType: "full_time" | "intern" | "contractor";
  basic: number;
  bankAccount: string | null;
  joinOffsetDays: number;
  /** When true, create an approved leave covering today. */
  leaveToday: boolean;
};

/** Wave 1 (~300): original ten departments, Engineering-heavy. */
const DEPT_WEIGHTS_WAVE1: { name: BulkDepartment; weight: number }[] = [
  { name: "Engineering", weight: 72 },
  { name: "Sales", weight: 42 },
  { name: "Customer Success", weight: 36 },
  { name: "Product", weight: 30 },
  { name: "Finance", weight: 28 },
  { name: "Operations", weight: 24 },
  { name: "Marketing", weight: 22 },
  { name: "Human Resources", weight: 18 },
  { name: "Design", weight: 16 },
  { name: "Legal", weight: 12 },
];

/** Wave 2 (+300): broader mix including newer departments. */
const DEPT_WEIGHTS_WAVE2: { name: BulkDepartment; weight: number }[] = [
  { name: "Engineering", weight: 48 },
  { name: "IT Support", weight: 28 },
  { name: "Data Analytics", weight: 26 },
  { name: "Quality Assurance", weight: 24 },
  { name: "Sales", weight: 28 },
  { name: "Customer Success", weight: 22 },
  { name: "Product", weight: 20 },
  { name: "Finance", weight: 18 },
  { name: "Operations", weight: 18 },
  { name: "Marketing", weight: 16 },
  { name: "Procurement", weight: 16 },
  { name: "Human Resources", weight: 14 },
  { name: "Design", weight: 12 },
  { name: "Legal", weight: 10 },
];

function rosterFromWeights(weights: { name: BulkDepartment; weight: number }[]) {
  return weights.flatMap((row) => Array.from({ length: row.weight }, () => row.name));
}

const DEPT_ROSTER_WAVE1 = rosterFromWeights(DEPT_WEIGHTS_WAVE1);
const DEPT_ROSTER_WAVE2 = rosterFromWeights(DEPT_WEIGHTS_WAVE2);

function pickDept(i: number, wave: 1 | 2): BulkDepartment {
  const roster = wave === 1 ? DEPT_ROSTER_WAVE1 : DEPT_ROSTER_WAVE2;
  return roster[i % roster.length]!;
}

export type BuildBulkOptions = {
  /** Global index offset (wave 1 = 0, wave 2 = 300). */
  startIndex?: number;
  /** Department mix: wave1 = classic ten depts; wave2 = fourteen depts. */
  wave?: 1 | 2;
};

/** Produces diverse roster rows. Default: wave 1, indexes 0..count-1. */
export function buildBulkEmployees(count = 300, options?: BuildBulkOptions): BulkEmployeeSeed[] {
  const start = options?.startIndex ?? 0;
  const wave = options?.wave ?? (start >= 300 ? 2 : 1);
  const rows: BulkEmployeeSeed[] = [];

  for (let i = 0; i < count; i += 1) {
    const idx = start + i;
    const first = pick(FIRST, idx);
    const last = pick(LAST, idx * 3 + 1);
    const department = pickDept(i, wave);
    const titles = BULK_TITLES[department];
    const jobTitle = pick(titles, idx * 2);
    const name = `${first} ${last}`;
    const email = `${slugify(first)}.${slugify(last)}.${String(idx + 1).padStart(3, "0")}@odoo.com`;

    // Status mix: ~72% active, ~14% on leave, ~14% inactive
    const statusRoll = idx % 7;
    const status: BulkEmployeeSeed["status"] =
      statusRoll === 0 || statusRoll === 1
        ? "on_leave"
        : statusRoll === 2
          ? "inactive"
          : "active";

    const typeRoll = idx % 11;
    const employeeType: BulkEmployeeSeed["employeeType"] =
      typeRoll === 0 ? "intern" : typeRoll === 1 || typeRoll === 2 ? "contractor" : "full_time";

    const basicBase =
      employeeType === "intern" ? 15000 : employeeType === "contractor" ? 35000 : 45000;
    const deptBump =
      department === "Engineering" || department === "Data Analytics"
        ? 12000
        : department === "Legal"
          ? 8000
          : department === "Sales"
            ? 5000
            : department === "IT Support" || department === "Quality Assurance"
              ? 4000
              : 0;
    const basic = basicBase + deptBump + (idx % 20) * 1500;

    rows.push({
      name,
      email,
      employeeId:
        wave === 2
          ? `ODOO-2026-W2-${String(i + 1).padStart(3, "0")}`
          : `ODOO-2026-${String(idx + 100).padStart(3, "0")}`,
      department,
      jobTitle,
      phone: `+91 9${String(100000000 + ((idx * 7919) % 89999999)).slice(0, 9)}`,
      status,
      employeeType,
      basic,
      bankAccount: status === "inactive" || idx % 9 === 0 ? null : `HDFC${String(100000 + idx)}`,
      joinOffsetDays: 30 + (idx % 720),
      leaveToday: status === "on_leave",
    });
  }
  return rows;
}
