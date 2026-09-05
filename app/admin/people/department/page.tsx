"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Plus,
  Search,
  ChevronDown,
  MoreHorizontal,
  FilterX,
} from "lucide-react";
import { cn } from "@/utils/cn";

// Mock Department Data
const initialDepartments = [
  {
    id: "DEP001",
    name: "Engineering",
    description:
      "Builds and maintains core HRMS products, dashboard interfaces, and database backends.",
    icon: "💻",
    managerName: "Bruce Banner",
    managerAvatar: "BB",
    employeeCount: 42,
    avgTeamSize: 8,
    status: "Active",
    teamMembers: ["JC", "DS", "AM", "BB", "LH"],
  },
  {
    id: "DEP002",
    name: "HR",
    description:
      "Manages employee relations, talent acquisition, onboarding, benefits, and workplace culture.",
    icon: "👥",
    managerName: "Sarah Mills",
    managerAvatar: "SM",
    employeeCount: 12,
    avgTeamSize: 4,
    status: "Active",
    teamMembers: ["SM", "CO", "RD", "PL"],
  },
  {
    id: "DEP003",
    name: "Sales",
    description:
      "Drives customer acquisition, enterprise relationships, and monthly revenue growth.",
    icon: "📈",
    managerName: "William Vance",
    managerAvatar: "WV",
    employeeCount: 18,
    avgTeamSize: 6,
    status: "Active",
    teamMembers: ["ML", "JK", "TY", "WV"],
  },
  {
    id: "DEP004",
    name: "Marketing",
    description:
      "Manages brand positioning, digital campaigns, social outreach, and SEO optimizations.",
    icon: "🎯",
    managerName: "Emma Watson",
    managerAvatar: "EW",
    employeeCount: 15,
    avgTeamSize: 5,
    status: "Active",
    teamMembers: ["KN", "EW", "DF", "TG", "HJ"],
  },
  {
    id: "DEP005",
    name: "Finance",
    description:
      "Oversees corporate accounting, budgets, payroll compliance, tax filing, and audits.",
    icon: "💰",
    managerName: "William Vance",
    managerAvatar: "WV",
    employeeCount: 13,
    avgTeamSize: 4,
    status: "Active",
    teamMembers: ["WV", "AD", "MK", "SL"],
  },
];

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState(initialDepartments);
  const [search, setSearch] = useState("");
  const [selectedManager, setSelectedManager] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [sortBy, setSortBy] = useState("Name-ASC");

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

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
  const filteredDepartments = departments.filter((dept) => {
    const matchesSearch =
      dept.name.toLowerCase().includes(search.toLowerCase()) ||
      dept.description.toLowerCase().includes(search.toLowerCase()) ||
      dept.managerName.toLowerCase().includes(search.toLowerCase());

    const matchesManager =
      selectedManager === "All" || dept.managerName === selectedManager;
    const matchesStatus =
      selectedStatus === "All" || dept.status === selectedStatus;

    return matchesSearch && matchesManager && matchesStatus;
  });

  // Sort Logic
  const sortedDepartments = [...filteredDepartments].sort((a, b) => {
    if (sortBy === "Name-ASC") {
      return a.name.localeCompare(b.name);
    }
    if (sortBy === "Name-DESC") {
      return b.name.localeCompare(a.name);
    }
    if (sortBy === "Employees-DESC") {
      return b.employeeCount - a.employeeCount;
    }
    if (sortBy === "Employees-ASC") {
      return a.employeeCount - b.employeeCount;
    }
    return 0;
  });

  // Clear Filters
  const handleClearFilters = () => {
    setSearch("");
    setSelectedManager("All");
    setSelectedStatus("All");
    setSortBy("Name-ASC");
  };

  // Unique list of managers for dropdown filter
  const managers = [
    "All",
    ...Array.from(new Set(departments.map((d) => d.managerName))),
  ];
  const statuses = ["All", "Active", "Restructured"];

  // Stats calculation
  const totalCount = departments.length;
  const largestDept =
    [...departments].sort((a, b) => b.employeeCount - a.employeeCount)[0]
      ?.name || "N/A";
  const managersCount = Array.from(
    new Set(departments.map((d) => d.managerName)),
  ).length;
  const avgTeamSize = Math.round(
    departments.reduce((acc, d) => acc + d.employeeCount, 0) /
      (departments.length || 1),
  );

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <h1 className="text-h1 font-medium">Departments</h1>
          <p className="text-body-lg text-zinc-500 font-medium">
            Organize employees into departments and manage team structure.
          </p>
        </div>
        <button className="cursor-pointer flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-98 transition-all">
          <Plus className="size-4" />
          Add Department
        </button>
      </div>

      {/* Statistics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Departments", value: totalCount },
          { label: "Largest Department", value: largestDept },
          { label: "Department Managers", value: managersCount },
          { label: "Average Team Size", value: `${avgTeamSize} Members` },
        ].map((stat, idx) => (
          <div
            key={idx}
            className="border border-border rounded-xl p-5 bg-surface flex flex-col justify-between"
          >
            <span className="text-sm font-medium text-zinc-500">
              {stat.label}
            </span>
            <span className="text-2xl font-bold text-zinc-950 mt-2">
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      {/* Filters Section */}
      <div className="border border-border rounded-xl p-4 bg-surface flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="relative flex items-center">
            <Search className="absolute left-3 size-4 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search Departments..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-3 border border-border rounded-lg text-sm text-zinc-900 bg-surface focus:outline-none focus:border-border-strong transition-colors"
            />
          </div>

          {/* Manager Filter */}
          <div className="relative">
            <select
              value={selectedManager}
              onChange={(e) => setSelectedManager(e.target.value)}
              className="w-full h-10 px-3 border border-border rounded-lg text-sm text-zinc-700 bg-surface focus:outline-none focus:border-border-strong appearance-none cursor-pointer"
            >
              <option disabled>Manager</option>
              {managers.map((mgr) => (
                <option key={mgr} value={mgr}>
                  {mgr === "All" ? "All Managers" : mgr}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-3 size-4 text-zinc-400 pointer-events-none" />
          </div>

          {/* Status Filter */}
          <div className="relative">
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

          {/* Sort By Filter */}
          <div className="relative flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full h-10 px-3 border border-border rounded-lg text-sm text-zinc-700 bg-surface focus:outline-none focus:border-border-strong appearance-none cursor-pointer"
              >
                <option disabled>Sort By</option>
                <option value="Name-ASC">Name (A - Z)</option>
                <option value="Name-DESC">Name (Z - A)</option>
                <option value="Employees-DESC">Employees (High to Low)</option>
                <option value="Employees-ASC">Employees (Low to High)</option>
              </select>
              <ChevronDown className="absolute right-3 top-3 size-4 text-zinc-400 pointer-events-none" />
            </div>

            {(search ||
              selectedManager !== "All" ||
              selectedStatus !== "All" ||
              sortBy !== "Name-ASC") && (
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

      {/* Departments Grid Content */}
      {sortedDepartments.length === 0 ? (
        <div className="border border-border border-dashed rounded-xl py-16 text-center text-sm font-medium text-zinc-400">
          No departments found matching selected filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedDepartments.map((dept) => {
            return (
              <div
                key={dept.id}
                className="border border-border rounded-2xl p-5 bg-surface hover:border-zinc-300 hover:shadow-2xs transition-all flex flex-col justify-between min-h-[300px] relative group"
              >
                {/* Header Action & Icon */}
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-xl border border-zinc-200">
                    {dept.icon}
                  </div>
                  <div
                    className="relative"
                    ref={activeMenuId === dept.id ? dropdownRef : null}
                  >
                    <button
                      onClick={() =>
                        setActiveMenuId(
                          activeMenuId === dept.id ? null : dept.id,
                        )
                      }
                      className="cursor-pointer p-1.5 rounded-lg border border-transparent hover:border-zinc-200 hover:bg-zinc-50 text-zinc-400 hover:text-zinc-900 active:scale-95 transition-all"
                    >
                      <MoreHorizontal className="size-4" />
                    </button>

                    {/* Actions Menu Popup */}
                    {activeMenuId === dept.id && (
                      <div className="absolute right-0 top-8 w-44 bg-surface border border-border rounded-lg shadow-lg py-1.5 z-40 text-left animate-in fade-in slide-in-from-top-1 duration-100">
                        <button className="cursor-pointer w-full text-left flex px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950">
                          Edit Department
                        </button>
                        <button className="cursor-pointer w-full text-left flex px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950">
                          Manage Members
                        </button>
                        <button className="cursor-pointer w-full text-left flex px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950">
                          Department Settings
                        </button>
                        <hr className="border-border my-1" />
                        <button className="cursor-pointer w-full text-left flex px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700">
                          Delete Department
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Title & Description */}
                <div className="mt-4 flex-1">
                  <h3 className="text-lg font-bold text-zinc-950 tracking-tight leading-tight">
                    {dept.name}
                  </h3>
                  <p className="text-xs text-zinc-500 font-medium mt-1 leading-snug">
                    {dept.employeeCount} Employees &bull; Avg. Team Size:{" "}
                    {dept.avgTeamSize}
                  </p>
                  <p className="text-sm text-zinc-600 mt-3 leading-relaxed line-clamp-3">
                    {dept.description}
                  </p>
                </div>

                {/* Team Member Avatars Group */}
                <div className="flex items-center gap-1 mt-5">
                  <div className="flex -space-x-2.5 overflow-hidden">
                    {dept.teamMembers.map((member, i) => (
                      <div
                        key={i}
                        className="size-7 rounded-full bg-zinc-100 border-2 border-white text-[10px] font-bold text-zinc-800 flex items-center justify-center shrink-0 shadow-3xs"
                      >
                        {member}
                      </div>
                    ))}
                  </div>
                  {dept.employeeCount > dept.teamMembers.length && (
                    <span className="text-xs font-semibold text-zinc-400 ml-1.5">
                      +{dept.employeeCount - dept.teamMembers.length} more
                    </span>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div className="mt-5 pt-4 border-t border-border flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="size-6 rounded-full bg-zinc-100 flex items-center justify-center font-bold text-[9px] text-zinc-800 border border-zinc-200 shrink-0">
                      {dept.managerAvatar}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] font-semibold text-zinc-400 uppercase leading-none">
                        Manager
                      </span>
                      <span className="text-xs font-semibold text-zinc-900 truncate leading-tight mt-0.5">
                        {dept.managerName}
                      </span>
                    </div>
                  </div>
                  <button className="cursor-pointer px-3 py-1.5 border border-border bg-surface hover:bg-zinc-950 hover:text-white hover:border-zinc-950 text-zinc-700 text-xs font-bold rounded-lg shadow-3xs active:scale-98 transition-all shrink-0">
                    View Department
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
