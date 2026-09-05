/**
 * Deterministic bulk roster used by prisma/seed.ts.
 * ~300 people across departments, statuses, and employment types.
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
] as const;

export const BULK_TITLES: Record<(typeof BULK_DEPARTMENTS)[number], string[]> = {
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
  department: (typeof BULK_DEPARTMENTS)[number];
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

const DEPT_WEIGHTS: { name: (typeof BULK_DEPARTMENTS)[number]; weight: number }[] = [
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

const DEPT_ROSTER: (typeof BULK_DEPARTMENTS)[number][] = DEPT_WEIGHTS.flatMap((row) =>
  Array.from({ length: row.weight }, () => row.name),
);

function pickDept(i: number): (typeof BULK_DEPARTMENTS)[number] {
  return DEPT_ROSTER[i % DEPT_ROSTER.length]!;
}

/** Produces 300 diverse roster rows (indexes 0..299). */
export function buildBulkEmployees(count = 300): BulkEmployeeSeed[] {
  const rows: BulkEmployeeSeed[] = [];
  for (let i = 0; i < count; i += 1) {
    const first = pick(FIRST, i);
    const last = pick(LAST, i * 3 + 1);
    const department = pickDept(i);
    const titles = BULK_TITLES[department];
    const jobTitle = pick(titles, i * 2);
    const name = `${first} ${last}`;
    const email = `${slugify(first)}.${slugify(last)}.${String(i + 1).padStart(3, "0")}@oddo.com`;

    // Status mix: ~72% active, ~14% on leave, ~14% inactive
    const statusRoll = i % 7;
    const status: BulkEmployeeSeed["status"] =
      statusRoll === 0 || statusRoll === 1
        ? "on_leave"
        : statusRoll === 2
          ? "inactive"
          : "active";

    const typeRoll = i % 11;
    const employeeType: BulkEmployeeSeed["employeeType"] =
      typeRoll === 0 ? "intern" : typeRoll === 1 || typeRoll === 2 ? "contractor" : "full_time";

    const basicBase =
      employeeType === "intern" ? 15000 : employeeType === "contractor" ? 35000 : 45000;
    const deptBump =
      department === "Engineering"
        ? 12000
        : department === "Legal"
          ? 8000
          : department === "Sales"
            ? 5000
            : 0;
    const basic = basicBase + deptBump + (i % 20) * 1500;

    rows.push({
      name,
      email,
      employeeId: `ODDO-2026-${String(i + 100).padStart(3, "0")}`,
      department,
      jobTitle,
      phone: `+91 9${String(100000000 + ((i * 7919) % 89999999)).slice(0, 9)}`,
      status,
      employeeType,
      basic,
      bankAccount: status === "inactive" || i % 9 === 0 ? null : `HDFC${String(100000 + i)}`,
      joinOffsetDays: 30 + (i % 720),
      leaveToday: status === "on_leave",
    });
  }
  return rows;
}
