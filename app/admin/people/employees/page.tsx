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
import { PersonAvatar } from "@/components/ui/person-avatar";
import { Modal } from "@/components/ui/modal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [employees, setEmployees] = useState(initialEmployees);
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("All");
  const [selectedRole, setSelectedRole] = useState("All");
  const [selectedType, setSelectedType] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<(typeof initialEmployees)[0] | null>(null);
  const [editTarget, setEditTarget] = useState<(typeof initialEmployees)[0] | null>(null);
  const [assetsTarget, setAssetsTarget] = useState<(typeof initialEmployees)[0] | null>(null);
  const [draftAsset, setDraftAsset] = useState({ name: "MacBook Pro 14", serial: "" });
  const [draftEmployee, setDraftEmployee] = useState({
    name: "",
    email: "",
    department: "Engineering",
    designation: "",
    type: "Full-time",
  });

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

  const handleAddEmployee = () => {
    if (!draftEmployee.name.trim() || !draftEmployee.email.trim()) {
      toast.error("Name and email are required");
      return;
    }

    const nextId = `EMP${String(employees.length + 1).padStart(3, "0")}`;
    setEmployees((current) => [
      {
        id: nextId,
        name: draftEmployee.name.trim(),
        email: draftEmployee.email.trim(),
        avatar: draftEmployee.name
          .split(" ")
          .map((part) => part[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
        department: draftEmployee.department,
        designation: draftEmployee.designation || "Team Member",
        type: draftEmployee.type,
        joinDate: new Date().toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        status: "Active",
      },
      ...current,
    ]);
    setDraftEmployee({
      name: "",
      email: "",
      department: "Engineering",
      designation: "",
      type: "Full-time",
    });
    setIsAddOpen(false);
    toast.success("Employee added");
  };

  const handleDeleteEmployee = () => {
    if (!deleteTarget) return;
    setEmployees((current) => current.filter((emp) => emp.id !== deleteTarget.id));
    setSelectedIds((current) => current.filter((id) => id !== deleteTarget.id));
    toast.success(`${deleteTarget.name} removed`);
    setDeleteTarget(null);
    setActiveMenuId(null);
  };

  const handleSaveEdit = () => {
    if (!editTarget) return;
    setEmployees((current) =>
      current.map((emp) =>
        emp.id === editTarget.id
          ? {
              ...emp,
              name: draftEmployee.name.trim(),
              email: draftEmployee.email.trim(),
              department: draftEmployee.department,
              designation: draftEmployee.designation,
              type: draftEmployee.type,
            }
          : emp,
      ),
    );
    setEditTarget(null);
    toast.success("Employee updated");
  };

  const handleAssignAsset = () => {
    if (!assetsTarget || !draftAsset.name.trim()) return;
    setAssetsTarget(null);
    toast.success("Asset assigned", {
      description: `${draftAsset.name} assigned to ${assetsTarget.name}.`,
    });
    setDraftAsset({ name: "MacBook Pro 14", serial: "" });
  };

  const handleMenuAction = (
    action: string,
    emp: (typeof initialEmployees)[0],
  ) => {
    setActiveMenuId(null);
    switch (action) {
      case "attendance":
        router.push(`/admin/people/attendance?q=${encodeURIComponent(emp.name)}`);
        return;
      case "leave":
        router.push(`/admin/people/leave?q=${encodeURIComponent(emp.name)}`);
        return;
      case "payroll":
        router.push(`/admin/hr/payroll?q=${encodeURIComponent(emp.name)}`);
        return;
      case "edit":
        setEditTarget(emp);
        setDraftEmployee({
          name: emp.name,
          email: emp.email,
          department: emp.department,
          designation: emp.designation,
          type: emp.type,
        });
        return;
      case "assets":
        setAssetsTarget(emp);
        return;
      case "delete":
        setDeleteTarget(emp);
        return;
      default:
        return;
    }
  };

  const statFilters = [
    { label: "Total Employees", value: totalCount, filter: "All" },
    { label: "Active Employees", value: activeCount, filter: "Active" },
    { label: "On Leave", value: onLeaveCount, filter: "On Leave" },
    { label: "Inactive Employees", value: inactiveCount, filter: "Inactive" },
  ];

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <h1 className="type-title">Employees</h1>
          <p className="type-subtitle">
            Manage and view all employees in your organization.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsImportOpen(true)}
            className="cursor-pointer flex items-center gap-2 px-3 py-2 border border-border rounded-lg bg-surface hover:bg-surface-hover hover:border-border-strong text-sm font-semibold text-zinc-700 shadow-2xs active:scale-[0.98] transition-[transform,background-color,border-color] duration-150 ease-out"
          >
            <Upload className="size-4 text-zinc-500" />
            Import Employees
          </button>
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="cursor-pointer flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-[0.98] transition-[transform,background-color] duration-150 ease-out"
          >
            <Plus className="size-4" />
            Add Employee
          </button>
        </div>
      </div>

      {/* Statistics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: statFilters[0].label,
            value: statFilters[0].value,
            filter: statFilters[0].filter,
            icon: TotalEmployeeIcon,
            bgStart: "#18181B",
            bgEnd: "#71717A",
            strokeColor: "39, 39, 42",
            shadowColor: "rgba(24, 24, 27, 0.15)",
          },
          {
            label: statFilters[1].label,
            value: statFilters[1].value,
            filter: statFilters[1].filter,
            icon: PresentTodayIcon,
            bgStart: "#18181B",
            bgEnd: "#71717A",
            strokeColor: "39, 39, 42",
            shadowColor: "rgba(24, 24, 27, 0.15)",
          },
          {
            label: statFilters[2].label,
            value: statFilters[2].value,
            filter: statFilters[2].filter,
            icon: LeaveTodayIcon,
            bgStart: "#18181B",
            bgEnd: "#71717A",
            strokeColor: "39, 39, 42",
            shadowColor: "rgba(24, 24, 27, 0.15)",
          },
          {
            label: statFilters[3].label,
            value: statFilters[3].value,
            filter: statFilters[3].filter,
            icon: InactiveIcon,
            bgStart: "#18181B",
            bgEnd: "#71717A",
            strokeColor: "39, 39, 42",
            shadowColor: "rgba(24, 24, 27, 0.15)",
          },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <button
              key={stat.label}
              type="button"
              onClick={() => setSelectedStatus(stat.filter)}
              className={cn(
                "cursor-pointer border rounded-xl p-5 bg-surface flex flex-col justify-between min-h-[140px] text-left hover:shadow-sm hover:border-border-strong active:scale-[0.99] transition-[transform,box-shadow,border-color] duration-200 ease-out",
                selectedStatus === stat.filter
                  ? "border-zinc-950"
                  : "border-border",
              )}
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
                <span className="type-metric">
                  {stat.value}
                </span>
              </div>
              <p className="type-caption mt-2">
                {stat.label}
              </p>
            </button>
          );
        })}
      </div>

      {/* Filters Section */}
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

      {/* Employees Table Container */}
      <div className="border border-border rounded-xl bg-surface overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12 text-center px-4">
                <input
                  type="checkbox"
                  checked={
                    filteredEmployees.length > 0 &&
                    selectedIds.length === filteredEmployees.length
                  }
                  onChange={handleSelectAll}
                  className="size-4 border-zinc-300 rounded text-zinc-950 focus:ring-zinc-950/20 cursor-pointer"
                />
              </TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>ID</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Employment Type</TableHead>
              <TableHead>Joining Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEmployees.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={9}
                  className="py-12 text-center type-caption"
                >
                  No employees found matching selected filters.
                </TableCell>
              </TableRow>
            ) : (
              filteredEmployees.map((emp) => (
                <TableRow key={emp.id}>
                  <TableCell className="text-center px-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(emp.id)}
                      onChange={() => handleSelectRow(emp.id)}
                      className="size-4 border-zinc-300 rounded text-zinc-950 focus:ring-zinc-950/20 cursor-pointer"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/admin/people/employees/${emp.id}`}
                        className="cursor-pointer shrink-0"
                      >
                        <PersonAvatar
                          name={emp.name}
                          size={40}
                        />
                      </Link>
                      <div className="flex flex-col min-w-0">
                        <Link
                          href={`/admin/people/employees/${emp.id}`}
                          className="cursor-pointer font-semibold text-text-primary hover:underline leading-tight truncate text-left"
                        >
                          {emp.name}
                        </Link>
                        <span className="type-caption truncate text-left">
                          {emp.email}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-text-secondary font-medium">
                    {emp.id}
                  </TableCell>
                  <TableCell className="font-medium">{emp.department}</TableCell>
                  <TableCell className="text-text-secondary font-medium">
                    {emp.designation}
                  </TableCell>
                  <TableCell className="text-text-secondary font-medium">
                    {emp.type}
                  </TableCell>
                  <TableCell className="type-caption">{emp.joinDate}</TableCell>
                  <TableCell>
                    <StatusBadge status={emp.status} />
                  </TableCell>
                  <TableCell
                    className="text-right relative"
                    ref={activeMenuId === emp.id ? dropdownRef : null}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(
                          activeMenuId === emp.id ? null : emp.id,
                        );
                      }}
                      className="cursor-pointer p-1.5 rounded-md hover:bg-zinc-100 border border-transparent hover:border-zinc-200 text-zinc-500 hover:text-zinc-900 active:scale-95 transition-[transform,background-color,border-color,color] duration-150 ease-out focus:outline-none"
                    >
                      <MoreHorizontal className="size-4" />
                    </button>

                    {activeMenuId === emp.id && (
                      <div className="absolute right-6 top-12 w-48 bg-surface border border-border rounded-lg shadow-lg py-1.5 z-40 animate-in fade-in slide-in-from-top-2 duration-150 text-left">
                        <Link
                          href={`/admin/people/employees/${emp.id}`}
                          onClick={() => setActiveMenuId(null)}
                          className="flex px-4 py-2 type-caption text-text-secondary hover:bg-zinc-50 hover:text-text-primary"
                        >
                          View Profile
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleMenuAction("edit", emp)}
                          className="cursor-pointer w-full text-left flex px-4 py-2 type-caption text-text-secondary hover:bg-zinc-50 hover:text-text-primary"
                        >
                          Edit Employee
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMenuAction("attendance", emp)}
                          className="cursor-pointer w-full text-left flex px-4 py-2 type-caption text-text-secondary hover:bg-zinc-50 hover:text-text-primary"
                        >
                          Attendance
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMenuAction("leave", emp)}
                          className="cursor-pointer w-full text-left flex px-4 py-2 type-caption text-text-secondary hover:bg-zinc-50 hover:text-text-primary"
                        >
                          Leave History
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMenuAction("payroll", emp)}
                          className="cursor-pointer w-full text-left flex px-4 py-2 type-caption text-text-secondary hover:bg-zinc-50 hover:text-text-primary"
                        >
                          Payroll
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMenuAction("assets", emp)}
                          className="cursor-pointer w-full text-left flex px-4 py-2 type-caption text-text-secondary hover:bg-zinc-50 hover:text-text-primary"
                        >
                          Assign Assets
                        </button>
                        <hr className="border-border my-1" />
                        <button
                          type="button"
                          onClick={() => handleMenuAction("delete", emp)}
                          className="cursor-pointer w-full text-left flex px-4 py-2 type-caption font-semibold text-error hover:bg-red-50"
                        >
                          Delete Employee
                        </button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

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

      <Modal
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Add Employee"
        description="Create a new employee profile"
      >
        <div className="flex flex-col gap-4 text-left">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-500">
            Full name
            <input
              value={draftEmployee.name}
              onChange={(e) =>
                setDraftEmployee((current) => ({ ...current, name: e.target.value }))
              }
              className="h-10 px-3 border border-border rounded-lg text-sm text-zinc-900 bg-surface focus:outline-none focus:border-border-strong"
              placeholder="Jane Doe"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-500">
            Email
            <input
              value={draftEmployee.email}
              onChange={(e) =>
                setDraftEmployee((current) => ({ ...current, email: e.target.value }))
              }
              className="h-10 px-3 border border-border rounded-lg text-sm text-zinc-900 bg-surface focus:outline-none focus:border-border-strong"
              placeholder="jane.doe@organization.com"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-500">
              Department
              <select
                value={draftEmployee.department}
                onChange={(e) =>
                  setDraftEmployee((current) => ({
                    ...current,
                    department: e.target.value,
                  }))
                }
                className="h-10 px-3 border border-border rounded-lg text-sm text-zinc-700 bg-surface focus:outline-none focus:border-border-strong cursor-pointer"
              >
                {departments.filter((d) => d !== "All").map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-500">
              Employment type
              <select
                value={draftEmployee.type}
                onChange={(e) =>
                  setDraftEmployee((current) => ({ ...current, type: e.target.value }))
                }
                className="h-10 px-3 border border-border rounded-lg text-sm text-zinc-700 bg-surface focus:outline-none focus:border-border-strong cursor-pointer"
              >
                {types.filter((t) => t !== "All").map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-500">
            Designation
            <input
              value={draftEmployee.designation}
              onChange={(e) =>
                setDraftEmployee((current) => ({
                  ...current,
                  designation: e.target.value,
                }))
              }
              className="h-10 px-3 border border-border rounded-lg text-sm text-zinc-900 bg-surface focus:outline-none focus:border-border-strong"
              placeholder="Product Designer"
            />
          </label>
          <button
            type="button"
            onClick={handleAddEmployee}
            className="cursor-pointer mt-1 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-[0.98] transition-[transform,background-color] duration-150 ease-out"
          >
            Save Employee
          </button>
        </div>
      </Modal>

      <Modal
        open={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        title="Import Employees"
        description="Upload a CSV file to bulk import"
      >
        <div className="flex flex-col gap-4 text-left">
          <div className="border border-dashed border-border rounded-xl p-8 text-center bg-zinc-50/40">
            <Upload className="size-8 text-zinc-400 mx-auto mb-3" />
            <p className="text-sm font-semibold text-zinc-800">
              Drop CSV here or browse
            </p>
            <p className="text-xs text-zinc-500 font-medium mt-1">
              Columns: name, email, department, role
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsImportOpen(false);
              toast.success("Import queued", {
                description: "3 employees will be added after validation.",
              });
            }}
            className="cursor-pointer px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-[0.98] transition-[transform,background-color] duration-150 ease-out"
          >
            Start Import
          </button>
        </div>
      </Modal>

      <Modal
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title="Edit Employee"
        description={editTarget?.id}
      >
        <div className="flex flex-col gap-4 text-left">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-500">
            Full name
            <input
              value={draftEmployee.name}
              onChange={(e) =>
                setDraftEmployee((current) => ({ ...current, name: e.target.value }))
              }
              className="h-10 px-3 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-500">
            Email
            <input
              value={draftEmployee.email}
              onChange={(e) =>
                setDraftEmployee((current) => ({ ...current, email: e.target.value }))
              }
              className="h-10 px-3 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-500">
              Department
              <select
                value={draftEmployee.department}
                onChange={(e) =>
                  setDraftEmployee((current) => ({
                    ...current,
                    department: e.target.value,
                  }))
                }
                className="h-10 px-3 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong cursor-pointer"
              >
                {departments.filter((d) => d !== "All").map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-500">
              Employment type
              <select
                value={draftEmployee.type}
                onChange={(e) =>
                  setDraftEmployee((current) => ({ ...current, type: e.target.value }))
                }
                className="h-10 px-3 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong cursor-pointer"
              >
                {types.filter((t) => t !== "All").map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-500">
            Designation
            <input
              value={draftEmployee.designation}
              onChange={(e) =>
                setDraftEmployee((current) => ({
                  ...current,
                  designation: e.target.value,
                }))
              }
              className="h-10 px-3 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong"
            />
          </label>
          <button
            type="button"
            onClick={handleSaveEdit}
            className="cursor-pointer px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white active:scale-[0.98] transition-[transform,background-color] duration-150 ease-out"
          >
            Save Changes
          </button>
        </div>
      </Modal>

      <Modal
        open={Boolean(assetsTarget)}
        onClose={() => setAssetsTarget(null)}
        title="Assign Asset"
        description={assetsTarget?.name}
      >
        <div className="flex flex-col gap-4 text-left">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-500">
            Asset name
            <select
              value={draftAsset.name}
              onChange={(e) =>
                setDraftAsset((current) => ({ ...current, name: e.target.value }))
              }
              className="h-10 px-3 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong cursor-pointer"
            >
              {["MacBook Pro 14", "Dell Monitor 27", "Magic Keyboard", "iPhone 15"].map(
                (asset) => (
                  <option key={asset} value={asset}>
                    {asset}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-500">
            Serial number
            <input
              value={draftAsset.serial}
              onChange={(e) =>
                setDraftAsset((current) => ({ ...current, serial: e.target.value }))
              }
              placeholder="SN-000000"
              className="h-10 px-3 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong"
            />
          </label>
          <button
            type="button"
            onClick={handleAssignAsset}
            className="cursor-pointer px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white active:scale-[0.98] transition-[transform,background-color] duration-150 ease-out"
          >
            Assign Asset
          </button>
        </div>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete employee"
        description={deleteTarget?.name}
      >
        <div className="flex flex-col gap-4 text-left">
          <p className="text-sm text-zinc-600 font-medium">
            This removes the employee from the directory. You can restore them
            from archive later.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="cursor-pointer flex-1 px-3.5 py-2 rounded-lg border border-border bg-surface hover:bg-surface-hover text-sm font-semibold text-zinc-700 active:scale-[0.98] transition-[transform,background-color] duration-150 ease-out"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteEmployee}
              className="cursor-pointer flex-1 px-3.5 py-2 rounded-lg border border-red-200/50 bg-red-50 text-red-700 hover:bg-red-100/50 text-sm font-semibold active:scale-[0.98] transition-[transform,background-color] duration-150 ease-out"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
