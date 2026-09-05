"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  ChevronDown,
  Plus,
  Upload,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  FilterX,
} from "lucide-react";
import { cn } from "@/utils/cn";
import TotalEmployeeIcon from "@/components/icons/total-employee";
import PresentTodayIcon from "@/components/icons/present-today";
import LeaveTodayIcon from "@/components/icons/leave-today";
import InactiveIcon from "@/components/icons/inactive";

// Mock Employee Data
const initialEmployees = [
  {
    id: "EMP001",
    name: "John Cena",
    email: "john.cena@organization.com",
    avatar: "JC",
    department: "Engineering",
    designation: "Frontend Engineer",
    type: "Full-time",
    joinDate: "12 Jun 2024",
    status: "Active",
  },
  {
    id: "EMP002",
    name: "Sarah Mills",
    email: "sarah.mills@organization.com",
    avatar: "SM",
    department: "HR",
    designation: "HR Generalist",
    type: "Full-time",
    joinDate: "05 Jan 2024",
    status: "Active",
  },
  {
    id: "EMP003",
    name: "Mark Lou",
    email: "mark.lou@organization.com",
    avatar: "ML",
    department: "Sales",
    designation: "Sales Executive",
    type: "Full-time",
    joinDate: "20 Mar 2025",
    status: "On Leave",
  },
  {
    id: "EMP004",
    name: "Kimi Nowa",
    email: "kimi.nowa@organization.com",
    avatar: "KN",
    department: "Marketing",
    designation: "Marketing Specialist",
    type: "Part-time",
    joinDate: "15 Sep 2024",
    status: "Active",
  },
  {
    id: "EMP005",
    name: "William Vance",
    email: "william.vance@organization.com",
    avatar: "WV",
    department: "Finance",
    designation: "Financial Analyst",
    type: "Full-time",
    joinDate: "01 Feb 2023",
    status: "Active",
  },
  {
    id: "EMP006",
    name: "David Smith",
    email: "david.smith@organization.com",
    avatar: "DS",
    department: "Engineering",
    designation: "Backend Architect",
    type: "Full-time",
    joinDate: "10 Oct 2022",
    status: "Active",
  },
  {
    id: "EMP007",
    name: "Emma Watson",
    email: "emma.watson@organization.com",
    avatar: "EW",
    department: "Marketing",
    designation: "SEO Lead",
    type: "Contractor",
    joinDate: "18 Aug 2025",
    status: "Inactive",
  },
  {
    id: "EMP008",
    name: "Alex Mercer",
    email: "alex.mercer@organization.com",
    avatar: "AM",
    department: "Engineering",
    designation: "QA Engineer",
    type: "Intern",
    joinDate: "01 Dec 2025",
    status: "Active",
  },
  {
    id: "EMP009",
    name: "Clara Oswald",
    email: "clara.oswald@organization.com",
    avatar: "CO",
    department: "HR",
    designation: "Recruiting Coordinator",
    type: "Full-time",
    joinDate: "14 Jul 2024",
    status: "On Leave",
  },
  {
    id: "EMP010",
    name: "Bruce Banner",
    email: "bruce.banner@organization.com",
    avatar: "BB",
    department: "Engineering",
    designation: "R&D Specialist",
    type: "Full-time",
    joinDate: "30 May 2021",
    status: "Active",
  },
];

export default function EmployeesPage() {
  const [employees, setEmployees] = useState(initialEmployees);
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("All");
  const [selectedRole, setSelectedRole] = useState("All");
  const [selectedType, setSelectedType] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLTableCellElement>(null);

  // Close actions dropdown on clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setActiveMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter Logic
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(search.toLowerCase()) ||
      emp.id.toLowerCase().includes(search.toLowerCase()) ||
      emp.email.toLowerCase().includes(search.toLowerCase());

    const matchesDept =
      selectedDept === "All" || emp.department === selectedDept;
    const matchesRole =
      selectedRole === "All" || emp.designation === selectedRole;
    const matchesType = selectedType === "All" || emp.type === selectedType;
    const matchesStatus =
      selectedStatus === "All" || emp.status === selectedStatus;

    return (
      matchesSearch &&
      matchesDept &&
      matchesRole &&
      matchesType &&
      matchesStatus
    );
  });

  // Checkbox Handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredEmployees.map((emp) => emp.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  // Clear Filters
  const handleClearFilters = () => {
    setSearch("");
    setSelectedDept("All");
    setSelectedRole("All");
    setSelectedType("All");
    setSelectedStatus("All");
    setSelectedIds([]);
  };

  // Status Badge Class Helper
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-emerald-50 text-emerald-700 border border-emerald-200/50";
      case "On Leave":
        return "bg-amber-50 text-amber-700 border border-amber-200/50";
      case "Inactive":
      default:
        return "bg-zinc-50 text-zinc-500 border border-zinc-200";
    }
  };

  // Departments & Roles Lists
  const departments = [
    "All",
    "Engineering",
    "HR",
    "Sales",
    "Marketing",
    "Finance",
  ];
  const roles = [
    "All",
    "Frontend Engineer",
    "Backend Architect",
    "HR Generalist",
    "Sales Executive",
    "Marketing Specialist",
    "Financial Analyst",
    "SEO Lead",
    "QA Engineer",
    "R&D Specialist",
  ];
  const types = ["All", "Full-time", "Part-time", "Contractor", "Intern"];
  const statuses = ["All", "Active", "On Leave", "Inactive"];

  // Statistics calculation
  const totalCount = employees.length;
  const activeCount = employees.filter((e) => e.status === "Active").length;
  const onLeaveCount = employees.filter((e) => e.status === "On Leave").length;
  const inactiveCount = employees.filter((e) => e.status === "Inactive").length;

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <h1 className="text-h1 font-medium">Employees</h1>
          <p className="text-body-lg text-zinc-500 font-medium">
            Manage and view all employees in your organization.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="cursor-pointer flex items-center gap-2 px-3 py-2 border border-border rounded-lg bg-surface hover:bg-surface-hover hover:border-border-strong text-sm font-semibold text-zinc-700 shadow-2xs active:scale-98 transition-all">
            <Upload className="size-4 text-zinc-500" />
            Import Employees
          </button>
          <button className="cursor-pointer flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-98 transition-all">
            <Plus className="size-4" />
            Add Employee
          </button>
        </div>
      </div>

      {/* Statistics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total Employees",
            value: totalCount,
            icon: TotalEmployeeIcon,
            bgStart: "#18181B",
            bgEnd: "#71717A",
            strokeColor: "39, 39, 42",
            shadowColor: "rgba(24, 24, 27, 0.15)",
          },
          {
            label: "Active Employees",
            value: activeCount,
            icon: PresentTodayIcon,
            bgStart: "#059669",
            bgEnd: "#34D399",
            strokeColor: "4, 120, 87",
            shadowColor: "rgba(5, 150, 105, 0.15)",
          },
          {
            label: "On Leave",
            value: onLeaveCount,
            icon: LeaveTodayIcon,
            bgStart: "#D97706",
            bgEnd: "#FBBF24",
            strokeColor: "180, 83, 9",
            shadowColor: "rgba(217, 119, 6, 0.15)",
          },
          {
            label: "Inactive Employees",
            value: inactiveCount,
            icon: InactiveIcon,
            bgStart: "#71717A",
            bgEnd: "#A1A1AA",
            strokeColor: "63, 63, 70",
            shadowColor: "rgba(113, 113, 122, 0.15)",
          },
        ].map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={idx}
              className="border border-border rounded-xl p-5 bg-surface flex flex-col justify-between min-h-[140px] hover:shadow-sm hover:border-zinc-300 transition-all duration-200"
            >
              <div className="flex flex-col gap-4">
                <div
                  className="size-12 rounded-lg flex items-center justify-center text-white"
                  style={{
                    outline: `1px solid rgba(${stat.strokeColor}, 0.5)`,
                    outlineOffset: "-1px",
                    background: `linear-gradient(to top, ${stat.bgStart}, ${stat.bgEnd}) padding-box, linear-gradient(to bottom, rgba(${stat.strokeColor}, 0.5) 0%, rgba(${stat.strokeColor}, 0) 59%) border-box`,
                    boxShadow: `0 0 0 1px ${stat.shadowColor}`,
                  }}
                >
                  <Icon className="size-[30px]" />
                </div>
                <span className="text-2xl font-bold text-zinc-950 leading-none">
                  {stat.value}
                </span>
              </div>
              <p className="text-sm font-medium text-zinc-500 mt-2">
                {stat.label}
              </p>
            </div>
          );
        })}
      </div>

      {/* Filters Section */}
      <div className="border border-border rounded-xl p-4 bg-surface flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Box */}
          <div className="relative flex items-center">
            <Search className="absolute left-3 size-4 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search Employees..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-3 border border-border rounded-lg text-sm text-zinc-900 bg-surface focus:outline-none focus:border-border-strong transition-colors"
            />
          </div>

          {/* Department Filter */}
          <div className="relative">
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full h-10 px-3 border border-border rounded-lg text-sm text-zinc-700 bg-surface focus:outline-none focus:border-border-strong appearance-none cursor-pointer"
            >
              <option disabled>Department</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept === "All" ? "All Departments" : dept}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-3 size-4 text-zinc-400 pointer-events-none" />
          </div>

          {/* Role Filter */}
          <div className="relative">
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full h-10 px-3 border border-border rounded-lg text-sm text-zinc-700 bg-surface focus:outline-none focus:border-border-strong appearance-none cursor-pointer"
            >
              <option disabled>Role</option>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role === "All" ? "All Roles" : role}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-3 size-4 text-zinc-400 pointer-events-none" />
          </div>

          {/* Employment Type Filter */}
          <div className="relative">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full h-10 px-3 border border-border rounded-lg text-sm text-zinc-700 bg-surface focus:outline-none focus:border-border-strong appearance-none cursor-pointer"
            >
              <option disabled>Employment Type</option>
              {types.map((type) => (
                <option key={type} value={type}>
                  {type === "All" ? "All Types" : type}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-3 size-4 text-zinc-400 pointer-events-none" />
          </div>

          {/* Status Filter */}
          <div className="relative flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full h-10 px-3 border border-border rounded-lg text-sm text-zinc-700 bg-surface focus:outline-none focus:border-border-strong appearance-none cursor-pointer"
              >
                <option disabled>Status</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status === "All" ? "All Statuses" : status}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-3 size-4 text-zinc-400 pointer-events-none" />
            </div>

            {(search ||
              selectedDept !== "All" ||
              selectedRole !== "All" ||
              selectedType !== "All" ||
              selectedStatus !== "All") && (
              <button
                onClick={handleClearFilters}
                className="cursor-pointer h-10 px-3 border border-dashed border-zinc-200 text-zinc-500 hover:text-zinc-800 hover:border-zinc-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all bg-zinc-50/50"
              >
                <FilterX className="size-3.5" />
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Employees Table Container */}
      <div className="border border-border rounded-xl bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/80 border-b border-border text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                <th className="py-4 px-4 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={
                      filteredEmployees.length > 0 &&
                      selectedIds.length === filteredEmployees.length
                    }
                    onChange={handleSelectAll}
                    className="size-4 border-zinc-300 rounded text-zinc-950 focus:ring-zinc-950/20 cursor-pointer"
                  />
                </th>
                <th className="py-4 px-6 font-semibold">Employee</th>
                <th className="py-4 px-6 font-semibold">ID</th>
                <th className="py-4 px-6 font-semibold">Department</th>
                <th className="py-4 px-6 font-semibold">Designation</th>
                <th className="py-4 px-6 font-semibold">Employment Type</th>
                <th className="py-4 px-6 font-semibold">Joining Date</th>
                <th className="py-4 px-6 font-semibold">Status</th>
                <th className="py-4 px-6 font-semibold w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="py-12 text-center text-sm font-medium text-zinc-400"
                  >
                    No employees found matching selected filters.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr
                    key={emp.id}
                    className="hover:bg-zinc-50/40 text-sm text-zinc-700 transition-colors"
                  >
                    <td className="py-4 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(emp.id)}
                        onChange={() => handleSelectRow(emp.id)}
                        className="size-4 border-zinc-300 rounded text-zinc-950 focus:ring-zinc-950/20 cursor-pointer"
                      />
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/people/employees/${emp.id}`}
                          className="cursor-pointer size-10 rounded-full bg-zinc-100 flex items-center justify-center font-bold text-xs text-zinc-800 border border-zinc-200 shrink-0"
                        >
                          {emp.avatar}
                        </Link>
                        <div className="flex flex-col min-w-0">
                          <Link
                            href={`/people/employees/${emp.id}`}
                            className="cursor-pointer font-semibold text-zinc-950 hover:underline leading-tight truncate text-left"
                          >
                            {emp.name}
                          </Link>
                          <span className="text-xs text-zinc-400 truncate text-left">
                            {emp.email}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 font-medium text-zinc-500">
                      {emp.id}
                    </td>
                    <td className="py-4 px-6 font-medium">{emp.department}</td>
                    <td className="py-4 px-6 font-medium text-zinc-500">
                      {emp.designation}
                    </td>
                    <td className="py-4 px-6 text-zinc-500 font-medium">
                      {emp.type}
                    </td>
                    <td className="py-4 px-6 text-zinc-400 font-medium">
                      {emp.joinDate}
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={cn(
                          "whitespace-nowrap inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-semibold",
                          getStatusBadgeClass(emp.status),
                        )}
                      >
                        {emp.status}
                      </span>
                    </td>
                    <td
                      className="py-4 px-6 text-right relative"
                      ref={activeMenuId === emp.id ? dropdownRef : null}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(
                            activeMenuId === emp.id ? null : emp.id,
                          );
                        }}
                        className="cursor-pointer p-1.5 rounded-md hover:bg-zinc-100 border border-transparent hover:border-zinc-200 text-zinc-500 hover:text-zinc-900 active:scale-95 transition-all focus:outline-none"
                      >
                        <MoreHorizontal className="size-4" />
                      </button>

                      {/* Dropdown Menu */}
                      {activeMenuId === emp.id && (
                        <div className="absolute right-6 top-12 w-48 bg-surface border border-border rounded-lg shadow-lg py-1.5 z-40 animate-in fade-in slide-in-from-top-2 duration-100 text-left">
                          <Link
                            href={`/people/employees/${emp.id}`}
                            className="flex px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950"
                          >
                            View Profile
                          </Link>
                          <button className="cursor-pointer w-full text-left flex px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950">
                            Edit Employee
                          </button>
                          <button className="cursor-pointer w-full text-left flex px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950">
                            Attendance
                          </button>
                          <button className="cursor-pointer w-full text-left flex px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950">
                            Leave History
                          </button>
                          <button className="cursor-pointer w-full text-left flex px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950">
                            Payroll
                          </button>
                          <button className="cursor-pointer w-full text-left flex px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950">
                            Assign Assets
                          </button>
                          <hr className="border-border my-1" />
                          <button className="cursor-pointer w-full text-left flex px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-50 hover:text-red-700">
                            Delete Employee
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Section */}
        {filteredEmployees.length > 0 && (
          <div className="px-6 py-4 flex items-center justify-between border-t border-border bg-zinc-50/40 text-sm">
            <span className="text-zinc-500 font-medium">
              Showing{" "}
              <span className="text-zinc-900 font-semibold">
                {filteredEmployees.length}
              </span>{" "}
              of{" "}
              <span className="text-zinc-900 font-semibold">
                {filteredEmployees.length}
              </span>{" "}
              employees
            </span>
            <div className="flex items-center gap-1.5">
              <button
                className="p-1.5 border border-border rounded-lg bg-surface text-zinc-400 hover:text-zinc-700 disabled:opacity-40 transition-colors"
                disabled
              >
                <ChevronLeft className="size-4" />
              </button>
              <button className="size-8 flex items-center justify-center border border-border rounded-lg bg-zinc-950 text-white text-xs font-bold shadow-sm transition-colors">
                1
              </button>
              <button
                className="p-1.5 border border-border rounded-lg bg-surface text-zinc-400 hover:text-zinc-700 disabled:opacity-40 transition-colors"
                disabled
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
