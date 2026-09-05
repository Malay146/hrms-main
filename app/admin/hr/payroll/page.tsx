"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  ChevronDown,
  Download,
  Play,
  ArrowUpRight,
  Activity,
  FileText,
  CheckCircle2,
  Clock,
  X,
  Calendar,
  Building,
  TrendingUp,
  Wallet,
  CheckCircle,
  FileDown,
  Plus,
  ArrowRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";
import { cn } from "@/utils/cn";
import TotalPayrollIcon from "@/components/icons/total-payroll";
import PendingPayrollIcon from "@/components/icons/pending-payroll";
import AverageSalaryIcon from "@/components/icons/average-salary";
import CalendarIcon from "@/components/icons/calendar";

// Types
interface PayrollHistoryEntry {
  month: string;
  basic: number;
  bonus: number;
  deductions: number;
  net: number;
  status: "Paid" | "Processing" | "Pending";
}

interface EmployeePayroll {
  id: string;
  name: string;
  avatar: string;
  email: string;
  role: string;
  department: string;
  employmentType: "Full-time" | "Contractor";
  basicSalary: number;
  bonus: number;
  deductions: number;
  allowances: { name: string; amount: number }[];
  deductionsBreakdown: { name: string; amount: number }[];
  netSalary: number;
  status: "Paid" | "Processing" | "Pending";
  history: PayrollHistoryEntry[];
}

// Mock Payroll Data
const initialEmployees: EmployeePayroll[] = [
  {
    id: "EMP-2024-001",
    name: "William Joseph",
    avatar: "WJ",
    email: "william.joseph@organization.com",
    role: "HR Specialist",
    department: "Human Resources",
    employmentType: "Full-time",
    basicSalary: 6500,
    bonus: 500,
    deductions: 400,
    allowances: [
      { name: "Housing Allowance", amount: 300 },
      { name: "Transport Allowance", amount: 200 },
    ],
    deductionsBreakdown: [
      { name: "Provident Fund", amount: 250 },
      { name: "Health Insurance", amount: 150 },
    ],
    netSalary: 6600,
    status: "Paid",
    history: [
      {
        month: "June 2026",
        basic: 6500,
        bonus: 400,
        deductions: 400,
        net: 6500,
        status: "Paid",
      },
      {
        month: "May 2026",
        basic: 6500,
        bonus: 400,
        deductions: 400,
        net: 6500,
        status: "Paid",
      },
      {
        month: "April 2026",
        basic: 6500,
        bonus: 0,
        deductions: 400,
        net: 6100,
        status: "Paid",
      },
    ],
  },
  {
    id: "EMP-2024-002",
    name: "Bruce Banner",
    avatar: "BB",
    email: "bruce.banner@organization.com",
    role: "Engineering Lead",
    department: "Engineering",
    employmentType: "Full-time",
    basicSalary: 12000,
    bonus: 1200,
    deductions: 900,
    allowances: [
      { name: "Research Allowance", amount: 800 },
      { name: "Internet Allowance", amount: 400 },
    ],
    deductionsBreakdown: [
      { name: "Income Tax", amount: 600 },
      { name: "Provident Fund", amount: 300 },
    ],
    netSalary: 12300,
    status: "Paid",
    history: [
      {
        month: "June 2026",
        basic: 12000,
        bonus: 1000,
        deductions: 900,
        net: 12100,
        status: "Paid",
      },
      {
        month: "May 2026",
        basic: 12000,
        bonus: 800,
        deductions: 900,
        net: 11900,
        status: "Paid",
      },
    ],
  },
  {
    id: "EMP-2024-003",
    name: "Diana Prince",
    avatar: "DP",
    email: "diana.prince@organization.com",
    role: "Backend Architect",
    department: "Engineering",
    employmentType: "Full-time",
    basicSalary: 9500,
    bonus: 800,
    deductions: 650,
    allowances: [
      { name: "Remote Office Allowance", amount: 500 },
      { name: "Transport Allowance", amount: 300 },
    ],
    deductionsBreakdown: [
      { name: "Income Tax", amount: 400 },
      { name: "Provident Fund", amount: 250 },
    ],
    netSalary: 9650,
    status: "Paid",
    history: [
      {
        month: "June 2026",
        basic: 9500,
        bonus: 600,
        deductions: 650,
        net: 9450,
        status: "Paid",
      },
      {
        month: "May 2026",
        basic: 9500,
        bonus: 600,
        deductions: 650,
        net: 9450,
        status: "Paid",
      },
    ],
  },
  {
    id: "EMP-2024-004",
    name: "Alice Smith",
    avatar: "AS",
    email: "alice.smith@organization.com",
    role: "Frontend Engineer",
    department: "Engineering",
    employmentType: "Full-time",
    basicSalary: 5500,
    bonus: 300,
    deductions: 350,
    allowances: [
      { name: "Internet Allowance", amount: 150 },
      { name: "Wellness Allowance", amount: 150 },
    ],
    deductionsBreakdown: [
      { name: "Provident Fund", amount: 200 },
      { name: "Health Insurance", amount: 150 },
    ],
    netSalary: 5450,
    status: "Processing",
    history: [
      {
        month: "June 2026",
        basic: 5500,
        bonus: 200,
        deductions: 350,
        net: 5350,
        status: "Paid",
      },
      {
        month: "May 2026",
        basic: 5500,
        bonus: 200,
        deductions: 350,
        net: 5350,
        status: "Paid",
      },
    ],
  },
  {
    id: "EMP-2024-005",
    name: "Bob Johnson",
    avatar: "BJ",
    email: "bob.johnson@organization.com",
    role: "Product Manager",
    department: "Product",
    employmentType: "Full-time",
    basicSalary: 7000,
    bonus: 400,
    deductions: 500,
    allowances: [
      { name: "Housing Allowance", amount: 300 },
      { name: "Communication Allowance", amount: 100 },
    ],
    deductionsBreakdown: [
      { name: "Income Tax", amount: 300 },
      { name: "Provident Fund", amount: 200 },
    ],
    netSalary: 6900,
    status: "Pending",
    history: [
      {
        month: "June 2026",
        basic: 7000,
        bonus: 400,
        deductions: 500,
        net: 6900,
        status: "Paid",
      },
    ],
  },
  {
    id: "EMP-2024-006",
    name: "Charlie Brown",
    avatar: "CB",
    email: "charlie.brown@organization.com",
    role: "UX Designer",
    department: "Design",
    employmentType: "Contractor",
    basicSalary: 5000,
    bonus: 250,
    deductions: 300,
    allowances: [{ name: "Hardware Allowance", amount: 250 }],
    deductionsBreakdown: [
      { name: "Professional Tax", amount: 150 },
      { name: "Provident Fund", amount: 150 },
    ],
    netSalary: 4950,
    status: "Pending",
    history: [
      {
        month: "June 2026",
        basic: 5000,
        bonus: 0,
        deductions: 300,
        net: 4700,
        status: "Paid",
      },
    ],
  },
  {
    id: "EMP-2024-007",
    name: "Evan Wright",
    avatar: "EW",
    email: "evan.wright@organization.com",
    role: "QA Lead",
    department: "Engineering",
    employmentType: "Contractor",
    basicSalary: 5200,
    bonus: 200,
    deductions: 300,
    allowances: [{ name: "Hardware Allowance", amount: 200 }],
    deductionsBreakdown: [
      { name: "Professional Tax", amount: 150 },
      { name: "Provident Fund", amount: 150 },
    ],
    netSalary: 5100,
    status: "Processing",
    history: [
      {
        month: "June 2026",
        basic: 5200,
        bonus: 100,
        deductions: 300,
        net: 5000,
        status: "Paid",
      },
    ],
  },
  {
    id: "EMP-2024-008",
    name: "Fiona Gallagher",
    avatar: "FG",
    email: "fiona.gallagher@organization.com",
    role: "Frontend Engineer",
    department: "Engineering",
    employmentType: "Full-time",
    basicSalary: 5300,
    bonus: 350,
    deductions: 300,
    allowances: [
      { name: "Wellness Allowance", amount: 200 },
      { name: "Internet Allowance", amount: 150 },
    ],
    deductionsBreakdown: [
      { name: "Provident Fund", amount: 150 },
      { name: "Health Insurance", amount: 150 },
    ],
    netSalary: 5350,
    status: "Paid",
    history: [
      {
        month: "June 2026",
        basic: 5300,
        bonus: 250,
        deductions: 300,
        net: 5250,
        status: "Paid",
      },
    ],
  },
];

// Monthly Expense Data (for BarChart)
const expenseData = [
  { month: "Feb", payroll: 48000 },
  { month: "Mar", payroll: 51500 },
  { month: "Apr", payroll: 54000 },
  { month: "May", payroll: 56300 },
  { month: "Jun", payroll: 57200 },
  { month: "Jul", payroll: 56250 },
];

// Salary Distribution (Donut Chart)
const distributionData = [
  { name: "Engineering", value: 32350, color: "#18181B" },
  { name: "Human Resources", value: 6600, color: "#525252" },
  { name: "Product", value: 6900, color: "#737373" },
  { name: "Design", value: 4950, color: "#A3A3A3" },
  { name: "Operations", value: 5450, color: "#D4D4D8" },
];

// Recent Activities
const recentActivities = [
  {
    desc: "Payroll run executed for July 2026",
    user: "William Joseph (HR)",
    time: "10 mins ago",
  },
  {
    desc: "Bonus of $1,200 approved for Bruce Banner",
    user: "William Joseph (HR)",
    time: "1 hr ago",
  },
  {
    desc: "Deduction configuration updated for Alice Smith",
    user: "Bruce Banner (Eng Lead)",
    time: "4 hrs ago",
  },
  {
    desc: "June Payslips generated & emailed to all staff",
    user: "System",
    time: "1 day ago",
  },
];

// Upcoming schedule
const payrollSchedule = [
  {
    title: "July Mid-Month Contractor Payout",
    date: "24 Jul 2026",
    type: "Contractors",
  },
  {
    title: "August Full-Cycle Staff Payroll",
    date: "28 Aug 2026",
    type: "Full-Time Staff",
  },
];

export default function PayrollPage() {
  const [mounted, setMounted] = useState(false);
  const [employees, setEmployees] =
    useState<EmployeePayroll[]>(initialEmployees);
  const [selectedEmployee, setSelectedEmployee] =
    useState<EmployeePayroll | null>(null);

  // Filters state
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("All");
  const [selectedMonth, setSelectedMonth] = useState("July 2026");
  const [selectedType, setSelectedType] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Compute stats based on current employees list
  const stats = useMemo(() => {
    const total = employees.reduce((sum, emp) => sum + emp.netSalary, 0);
    const paid = employees
      .filter((emp) => emp.status === "Paid")
      .reduce((sum, emp) => sum + emp.netSalary, 0);
    const pending = employees
      .filter((emp) => emp.status === "Pending" || emp.status === "Processing")
      .reduce((sum, emp) => sum + emp.netSalary, 0);
    const avg = employees.length ? Math.round(total / employees.length) : 0;

    return {
      total: `$${total.toLocaleString()}`,
      paid: `$${paid.toLocaleString()}`,
      pending: `$${pending.toLocaleString()}`,
      avg: `$${avg.toLocaleString()}`,
    };
  }, [employees]);

  // Filters options
  const departments = [
    "All",
    "Engineering",
    "Human Resources",
    "Product",
    "Design",
  ];
  const months = ["July 2026", "June 2026", "May 2026"];
  const employmentTypes = ["All", "Full-time", "Contractor"];
  const statuses = ["All", "Paid", "Processing", "Pending"];

  // Filter logic
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchesSearch =
        emp.name.toLowerCase().includes(search.toLowerCase()) ||
        emp.id.toLowerCase().includes(search.toLowerCase());

      const matchesDept =
        selectedDept === "All" || emp.department === selectedDept;
      const matchesType =
        selectedType === "All" || emp.employmentType === selectedType;
      const matchesStatus =
        selectedStatus === "All" || emp.status === selectedStatus;

      return matchesSearch && matchesDept && matchesType && matchesStatus;
    });
  }, [employees, search, selectedDept, selectedType, selectedStatus]);

  // Handle Action: Run Payroll (simulate changing Pending/Processing to Paid)
  const handleRunPayroll = () => {
    setEmployees((prev) =>
      prev.map((emp) =>
        emp.status !== "Paid" ? { ...emp, status: "Paid" } : emp,
      ),
    );
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "Paid":
        return "bg-emerald-50 text-emerald-700 border border-emerald-200/50";
      case "Processing":
        return "bg-sky-50 text-sky-700 border border-sky-200/50 animate-pulse";
      case "Pending":
      default:
        return "bg-amber-50 text-amber-700 border border-amber-200/50";
    }
  };

  // Custom tooltips
  const ChartTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-surface border border-border px-3 py-1.5 rounded-lg shadow-sm text-xs font-semibold">
          <p className="text-zinc-500">Expense</p>
          <p className="text-zinc-900 font-bold mt-0.5">
            ${payload[0].value.toLocaleString()}
          </p>
        </div>
      );
    }
    return null;
  };

  const DonutTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-surface border border-border px-3 py-1.5 rounded-lg shadow-sm text-xs font-semibold">
          <p className="text-zinc-950 font-bold">{data.name}</p>
          <p className="text-zinc-500 mt-0.5">
            Share:{" "}
            <span className="text-zinc-900 font-bold">
              ${data.value.toLocaleString()}
            </span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6 relative select-none">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col text-left">
          <h1 className="text-h1 font-medium">Payroll</h1>
          <p className="text-body-lg text-zinc-500 font-medium">
            Manage employee salaries, payroll processing, and payslips.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="cursor-pointer flex items-center gap-2 px-4 py-2 border border-border rounded-lg bg-surface hover:bg-zinc-50 text-sm font-semibold text-zinc-700 shadow-2xs active:scale-98 transition-all">
            <Download className="size-4" />
            Export Payroll
          </button>
          <button
            onClick={handleRunPayroll}
            className="cursor-pointer flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-98 transition-all"
          >
            <Play className="size-4 fill-white" />
            Run Payroll
          </button>
        </div>
      </div>

      {/* Top Statistics Grid */}
      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: "Total Payroll",
            value: stats.total,
            subtext: "For current cycle",
            icon: TotalPayrollIcon,
          },
          {
            label: "Processed This Month",
            value: stats.paid,
            subtext: "Successfully completed",
            icon: CalendarIcon,
          },
          {
            label: "Pending Payroll",
            value: stats.pending,
            subtext: "Awaiting cycle action",
            icon: PendingPayrollIcon,
          },
          {
            label: "Average Salary",
            value: stats.avg,
            subtext: "Per active employee",
            icon: AverageSalaryIcon,
          },
        ].map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={idx}
              className="border border-border rounded-xl p-6 bg-surface flex flex-col justify-between text-left"
            >
              <div className="flex justify-between items-start">
                <span className="text-base font-semibold text-zinc-500">
                  {stat.label}
                </span>
                <Icon className="size-12 text-zinc-600 shrink-0" />
              </div>
              <span className="text-3xl font-extrabold text-zinc-950 mt-5 leading-none">
                {stat.value}
              </span>
              <span className="text-sm font-semibold text-zinc-400 mt-2.5 leading-none">
                {stat.subtext}
              </span>
            </div>
          );
        })}
      </div>

      {/* Monthly Payroll Expense & Filters Section */}
      <div className="grid grid-cols-12 gap-6 items-stretch mt-2">
        {/* Expense Bar Chart */}
        <div className="col-span-12 lg:col-span-8 border border-border rounded-xl p-5 bg-surface flex flex-col gap-4 text-left">
          <div className="flex items-center justify-between shrink-0">
            <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
              <TrendingUp className="size-4 text-zinc-400" />
              Monthly Payroll Expense Trend
            </h3>
            <span className="text-xs text-zinc-400 font-semibold">
              Amounts in USD ($)
            </span>
          </div>
          <div className="flex-1 w-full relative min-h-[240px]">
            {!mounted ? (
              <div className="absolute inset-0 bg-zinc-50 rounded-lg animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={expenseData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="payrollGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#E4E4E7" />
                      <stop offset="100%" stopColor="#18181B" />
                    </linearGradient>
                    <linearGradient
                      id="payrollBarStrokeGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#18181B" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#18181B" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    strokeDasharray="3 3"
                    stroke="#F4F4F5"
                  />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#A1A1AA", fontSize: 11, fontWeight: 600 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#A1A1AA", fontSize: 11, fontWeight: 600 }}
                    tickFormatter={(val) => `$${val / 1000}k`}
                  />
                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{ fill: "rgba(0, 0, 0, 0.02)", radius: 4 }}
                  />
                  <Bar
                    dataKey="payroll"
                    fill="url(#payrollGrad)"
                    stroke="url(#payrollBarStrokeGrad)"
                    strokeWidth={1}
                    radius={[8, 8, 0, 0]}
                    maxBarSize={48}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Filters Panel */}
        <div className="col-span-12 lg:col-span-4 border border-border rounded-xl p-5 bg-surface flex flex-col gap-3.5 text-left">
          <h3 className="text-xs font-bold text-zinc-950 uppercase tracking-wider">
            Filter Payroll
          </h3>
          <div className="flex flex-col gap-3">
            {/* Search */}
            <div className="relative flex items-center">
              <Search className="absolute left-3 size-4 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search employee..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-3 border border-border rounded-lg text-xs text-zinc-900 bg-surface focus:outline-none focus:border-zinc-400 transition-colors placeholder:text-zinc-400 font-semibold"
              />
            </div>

            {/* Department */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-zinc-400 uppercase">
                Department
              </span>
              <div className="relative">
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="w-full h-9 px-3 border border-border rounded-lg text-xs text-zinc-700 bg-surface focus:outline-none focus:border-zinc-400 appearance-none cursor-pointer font-semibold"
                >
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept === "All" ? "All Departments" : dept}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-2.5 size-4 text-zinc-400 pointer-events-none" />
              </div>
            </div>

            {/* Month & Type Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-zinc-400 uppercase">
                  Payroll Month
                </span>
                <div className="relative">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full h-9 px-3 border border-border rounded-lg text-xs text-zinc-700 bg-surface focus:outline-none focus:border-zinc-400 appearance-none cursor-pointer font-semibold"
                  >
                    {months.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-2.5 size-4 text-zinc-400 pointer-events-none" />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-zinc-400 uppercase">
                  Type
                </span>
                <div className="relative">
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="w-full h-9 px-3 border border-border rounded-lg text-xs text-zinc-700 bg-surface focus:outline-none focus:border-zinc-400 appearance-none cursor-pointer font-semibold"
                  >
                    {employmentTypes.map((t) => (
                      <option key={t} value={t}>
                        {t === "All" ? "All Types" : t}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-2.5 size-4 text-zinc-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-zinc-400 uppercase">
                Status
              </span>
              <div className="relative">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full h-9 px-3 border border-border rounded-lg text-xs text-zinc-700 bg-surface focus:outline-none focus:border-zinc-400 appearance-none cursor-pointer font-semibold"
                >
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {s === "All" ? "All Statuses" : s}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-2.5 size-4 text-zinc-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payroll Table */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-bold text-zinc-950 text-left">
          Employee Payroll List
        </h3>
        <div className="border border-border rounded-xl bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-zinc-50/80 border-b border-border text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  <th className="py-3 px-5 font-bold">Employee</th>
                  <th className="py-3 px-5 font-bold">Department</th>
                  <th className="py-3 px-5 font-bold">Basic Salary</th>
                  <th className="py-3 px-5 font-bold">Bonus</th>
                  <th className="py-3 px-5 font-bold">Deductions</th>
                  <th className="py-3 px-5 font-bold">Net Salary</th>
                  <th className="py-3 px-5 font-bold">Payroll Status</th>
                  <th className="py-3 px-5 font-bold w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-zinc-700 font-semibold">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-10 text-center text-zinc-400 font-semibold"
                    >
                      No payroll records match the filters.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => (
                    <tr
                      key={emp.id}
                      onClick={() => setSelectedEmployee(emp)}
                      className="hover:bg-zinc-50/50 cursor-pointer transition-colors group"
                    >
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-lg bg-zinc-100 flex items-center justify-center font-bold text-[10px] text-zinc-800 border border-zinc-200 shrink-0">
                            {emp.avatar}
                          </div>
                          <div className="flex flex-col text-left">
                            <span className="font-semibold text-zinc-950 group-hover:text-zinc-800 transition-colors">
                              {emp.name}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-semibold">
                              {emp.id} &bull; {emp.employmentType}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-zinc-600">
                        {emp.department}
                      </td>
                      <td className="py-3.5 px-5 text-zinc-950">
                        ${emp.basicSalary.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-5 text-emerald-600">
                        +${emp.bonus.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-5 text-red-500">
                        -${emp.deductions.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-5 text-zinc-950 font-bold">
                        ${emp.netSalary.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-5">
                        <span
                          className={cn(
                            "px-2.5 py-0.5 rounded-full text-[9px] font-bold inline-block leading-none border",
                            getStatusBadgeClass(emp.status),
                          )}
                        >
                          {emp.status}
                        </span>
                      </td>
                      <td
                        className="py-3.5 px-5 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => setSelectedEmployee(emp)}
                          className="cursor-pointer text-zinc-400 hover:text-zinc-800 text-[10px] font-bold underline transition-colors"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Bottom Section Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Salary Distribution (Donut Chart) */}
        <div className="border border-border rounded-xl p-5 bg-surface flex flex-col gap-4 text-left">
          <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
            <Building className="size-4 text-zinc-400" />
            Salary Distribution
          </h3>
          <div className="flex items-center gap-4 h-[195px]">
            <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
              {!mounted ? (
                <div className="w-40 h-40 rounded-full bg-zinc-50 animate-pulse" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip
                      content={<DonutTooltip />}
                      wrapperStyle={{ zIndex: 50 }}
                    />
                    <Pie
                      data={distributionData}
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      cornerRadius={4}
                      dataKey="value"
                    >
                      {distributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="flex-1 flex flex-col justify-center gap-1.5 max-h-[195px] overflow-y-auto pl-2">
              {distributionData.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between text-xs font-semibold"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-zinc-500 truncate max-w-[95px]">
                      {item.name}
                    </span>
                  </div>
                  <span className="text-zinc-900 font-bold shrink-0">
                    ${item.value.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Payroll Financial Summary */}
        <div className="border border-border rounded-xl p-5 bg-surface flex flex-col justify-between text-left">
          <div>
            <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2 mb-4">
              <Wallet className="size-4 text-zinc-400" />
              Payroll Summary
            </h3>
            <div className="flex flex-col gap-3 text-sm font-semibold">
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Gross Payroll</span>
                <span className="text-zinc-950 font-bold">$56,500</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Total Bonuses</span>
                <span className="text-emerald-600 font-bold">+$4,200</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Total Deductions</span>
                <span className="text-red-500 font-bold">-$3,700</span>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-border">
            <div className="flex justify-between items-center text-base font-bold">
              <span className="text-zinc-950">Net Payroll</span>
              <span className="text-zinc-950 font-black">$57,000</span>
            </div>
          </div>
        </div>

        {/* Upcoming Payroll Schedule & Quick Actions */}
        <div className="grid grid-rows-2 gap-4">
          {/* Upcoming Schedule */}
          <div className="border border-border rounded-xl p-4 bg-surface flex flex-col gap-3 text-left">
            <h3 className="text-xs font-bold text-zinc-950 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="size-3.5 text-zinc-400" />
              Upcoming Schedule
            </h3>
            <div className="flex flex-col gap-2 max-h-[70px] overflow-y-auto">
              {payrollSchedule.map((sch, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center text-xs font-semibold border-b border-zinc-100 last:border-0 pb-1.5 last:pb-0"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-zinc-900 truncate max-w-[150px]">
                      {sch.title}
                    </span>
                    <span className="text-zinc-400 text-[10px]">
                      {sch.type}
                    </span>
                  </div>
                  <span className="text-zinc-500 font-bold text-right shrink-0">
                    {sch.date}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="border border-border rounded-xl p-4 bg-surface flex flex-col gap-3 text-left">
            <h3 className="text-xs font-bold text-zinc-950 uppercase tracking-wider">
              Quick Actions
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs font-bold">
              <button className="cursor-pointer border border-border rounded-md py-2 text-center bg-surface hover:bg-zinc-50 text-zinc-700 shadow-3xs active:scale-98 transition-all">
                Generate Payslips
              </button>
              <button className="cursor-pointer border border-border rounded-md py-2 text-center bg-surface hover:bg-zinc-50 text-zinc-700 shadow-3xs active:scale-98 transition-all">
                Approve Bonuses
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Payroll Activity feed */}
      <div className="border border-border rounded-xl p-5 bg-surface flex flex-col gap-4 text-left">
        <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
          <Activity className="size-4 text-zinc-400" />
          Recent Payroll Activity
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3.5">
          {recentActivities.map((act, idx) => (
            <div key={idx} className="flex items-start gap-3 text-xs">
              <div className="size-1.5 bg-zinc-300 rounded-full mt-1.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-zinc-700 font-semibold leading-tight truncate">
                  {act.desc}
                </p>
                <span className="text-[10px] text-zinc-400 font-semibold block mt-0.5">
                  {act.time} &bull; by {act.user}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detailed Payroll Profile Slide-over Drawer */}
      {selectedEmployee && (
        <>
          {/* Backdrop overlay */}
          <div
            onClick={() => setSelectedEmployee(null)}
            className="fixed inset-0 bg-black/15 z-40 transition-opacity duration-300 backdrop-blur-3xs"
          />

          {/* Slide-over Drawer */}
          <div className="fixed inset-y-0 right-0 w-full sm:w-[500px] bg-surface border-l border-border shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col text-left">
            {/* Drawer Header */}
            <div className="px-6 py-5 border-b border-border flex items-center justify-between">
              <div className="flex flex-col">
                <h2 className="text-base font-bold text-zinc-950">
                  Payroll Profile
                </h2>
                <p className="text-xs text-zinc-400 font-semibold">
                  Detailed salary structure and pay slip history.
                </p>
              </div>
              <button
                onClick={() => setSelectedEmployee(null)}
                className="cursor-pointer p-1.5 rounded-lg border border-border text-zinc-400 hover:text-zinc-800 bg-surface shadow-3xs active:scale-95 transition-all"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Drawer Body Container */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 scrollbar-none">
              {/* Employee Summary Card */}
              <div className="border border-border rounded-xl p-4 bg-zinc-50/50 flex items-center gap-4">
                <div className="size-12 rounded-xl bg-zinc-150 border border-zinc-300 flex items-center justify-center font-bold text-base text-zinc-800 shrink-0 select-none">
                  {selectedEmployee.avatar}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold text-zinc-950 leading-tight">
                    {selectedEmployee.name}
                  </span>
                  <span className="text-xs text-zinc-400 font-semibold mt-0.5">
                    {selectedEmployee.role}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-semibold mt-1">
                    ID: {selectedEmployee.id} &bull;{" "}
                    {selectedEmployee.department}
                  </span>
                </div>
              </div>

              {/* Salary Structure */}
              <div className="flex flex-col gap-3">
                <h3 className="text-xs font-bold text-zinc-950 uppercase tracking-wider">
                  Salary Structure
                </h3>
                <div className="border border-border rounded-xl p-4 flex flex-col gap-3 text-xs font-semibold">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Basic Annual Contract</span>
                    <span className="text-zinc-900 font-bold">
                      ${(selectedEmployee.basicSalary * 12).toLocaleString()}/yr
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Basic Monthly Salary</span>
                    <span className="text-zinc-900 font-bold">
                      ${selectedEmployee.basicSalary.toLocaleString()}
                    </span>
                  </div>
                  {/* Allowances */}
                  {selectedEmployee.allowances.map((al, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center"
                    >
                      <span className="text-zinc-500">{al.name}</span>
                      <span className="text-emerald-600 font-bold">
                        +${al.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                  {/* Deductions */}
                  {selectedEmployee.deductionsBreakdown.map((dd, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center"
                    >
                      <span className="text-zinc-500">{dd.name}</span>
                      <span className="text-red-500 font-bold">
                        -${dd.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                  <div className="border-t border-border my-1" />
                  <div className="flex justify-between items-center text-sm font-bold text-zinc-950">
                    <span>Net Monthly Take-home</span>
                    <span className="font-black">
                      ${selectedEmployee.netSalary.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payroll History */}
              <div className="flex flex-col gap-3">
                <h3 className="text-xs font-bold text-zinc-950 uppercase tracking-wider">
                  Payroll History
                </h3>
                <div className="border border-border rounded-xl overflow-hidden text-xs">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-border font-bold text-zinc-400">
                        <th className="py-2.5 px-4">Month</th>
                        <th className="py-2.5 px-4">Net Paid</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-4 w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-zinc-700 font-semibold">
                      {selectedEmployee.history.map((hist, idx) => (
                        <tr key={idx} className="hover:bg-zinc-50/50">
                          <td className="py-2.5 px-4">{hist.month}</td>
                          <td className="py-2.5 px-4 text-zinc-950">
                            ${hist.net.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-4 text-[10px]">
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded-full text-[9px] font-bold border",
                                getStatusBadgeClass(hist.status),
                              )}
                            >
                              {hist.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <button className="cursor-pointer text-zinc-400 hover:text-zinc-800">
                              <FileDown className="size-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payslip Preview */}
              <div className="flex flex-col gap-3">
                <h3 className="text-xs font-bold text-zinc-950 uppercase tracking-wider">
                  Payslip Preview
                </h3>
                <div className="border border-zinc-200 rounded-xl p-5 bg-white text-zinc-800 font-mono text-[10px] leading-relaxed shadow-3xs">
                  <div className="flex justify-between border-b border-zinc-200 pb-3">
                    <div className="flex flex-col">
                      <span className="font-bold text-zinc-900 text-xs">
                        HRMS CORP
                      </span>
                      <span>Mumbai Office, IN</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold block text-zinc-900">
                        PAYSLIP ADVICE
                      </span>
                      <span>Month: {selectedMonth}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-b border-zinc-200 py-3 text-zinc-600">
                    <div className="flex flex-col gap-1">
                      <span>
                        Employee:{" "}
                        <strong className="text-zinc-900 font-semibold">
                          {selectedEmployee.name}
                        </strong>
                      </span>
                      <span>ID: {selectedEmployee.id}</span>
                      <span>Role: {selectedEmployee.role}</span>
                    </div>
                    <div className="flex flex-col gap-1 text-right">
                      <span>Bank: Standard Chartered</span>
                      <span>A/C No: *******9081</span>
                      <span>Type: {selectedEmployee.employmentType}</span>
                    </div>
                  </div>

                  <div className="py-3 flex flex-col gap-1.5">
                    <div className="flex justify-between font-bold text-zinc-900 border-b border-zinc-100 pb-1">
                      <span>EARNINGS</span>
                      <span>AMOUNT</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Basic Contract Salary</span>
                      <span>
                        ${selectedEmployee.basicSalary.toLocaleString()}.00
                      </span>
                    </div>
                    {selectedEmployee.allowances.map((al, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>{al.name}</span>
                        <span>${al.amount.toLocaleString()}.00</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-zinc-900 font-bold border-t border-zinc-100 pt-1 mt-1">
                      <span>GROSS EARNINGS</span>
                      <span>
                        $
                        {(
                          selectedEmployee.basicSalary +
                          selectedEmployee.allowances.reduce(
                            (sum, al) => sum + al.amount,
                            0,
                          )
                        ).toLocaleString()}
                        .00
                      </span>
                    </div>
                  </div>

                  <div className="py-3 flex flex-col gap-1.5">
                    <div className="flex justify-between font-bold text-zinc-900 border-b border-zinc-100 pb-1">
                      <span>DEDUCTIONS</span>
                      <span>AMOUNT</span>
                    </div>
                    {selectedEmployee.deductionsBreakdown.map((dd, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>{dd.name}</span>
                        <span>${dd.amount.toLocaleString()}.00</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-zinc-900 font-bold border-t border-zinc-100 pt-1 mt-1">
                      <span>TOTAL DEDUCTIONS</span>
                      <span>
                        ${selectedEmployee.deductions.toLocaleString()}.00
                      </span>
                    </div>
                  </div>

                  <div className="border-t-2 border-dashed border-zinc-300 pt-3 flex justify-between items-center text-xs font-bold text-zinc-900">
                    <span>NET DISTRIBUTED SALARY</span>
                    <span className="text-sm font-black">
                      ${selectedEmployee.netSalary.toLocaleString()}.00
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="px-6 py-4 border-t border-border flex items-center gap-3">
              <button className="cursor-pointer flex-1 py-2 border border-border bg-surface hover:bg-zinc-50 rounded-lg text-xs font-semibold text-zinc-700 shadow-3xs active:scale-98 transition-all text-center">
                Download Payslip PDF
              </button>
              <button className="cursor-pointer flex-1 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-white shadow-3xs active:scale-98 transition-all text-center">
                Email Payslip Advice
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
