"use client";

import React, { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { Modal } from "@/components/ui/modal";
import type { DepartmentListItem } from "@/lib/actions/departments";

export function DepartmentsClient({
  initialDepartments,
}: {
  initialDepartments: DepartmentListItem[];
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<DepartmentListItem | null>(null);

  const departments = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return initialDepartments;
    return initialDepartments.filter(
      (dept) =>
        dept.name.toLowerCase().includes(q) ||
        dept.managerName.toLowerCase().includes(q),
    );
  }, [initialDepartments, search]);

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="type-title">Departments</h1>
        <p className="type-subtitle">
          Live org chart grouped from employee profiles in Postgres.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-3 size-4 text-zinc-400 pointer-events-none" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search departments..."
          className="w-full h-10 pl-9 pr-3 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong"
        />
      </div>

      {departments.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl py-16 text-center text-sm text-zinc-400 font-medium">
          No departments yet. Create employees and assign a department.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {departments.map((dept) => (
            <button
              key={dept.id}
              type="button"
              onClick={() => setSelected(dept)}
              className="cursor-pointer text-left border border-border rounded-xl p-5 bg-surface hover:border-border-strong hover:shadow-sm transition-[box-shadow,border-color] duration-150"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-zinc-950">{dept.name}</h2>
                  <p className="text-xs text-zinc-500 mt-1 font-medium line-clamp-2">
                    {dept.description}
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-700 border border-zinc-200">
                  {dept.status}
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs font-semibold text-zinc-500">
                <span className="flex items-center gap-1.5">
                  <Users className="size-3.5" />
                  {dept.employeeCount} people
                </span>
                <span>Lead: {dept.managerName}</span>
              </div>
              <div className="mt-3 flex -space-x-2">
                {dept.members.slice(0, 5).map((member) => (
                  <PersonAvatar key={member.employeeId} name={member.name} size={28} />
                ))}
              </div>
            </button>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.name ?? "Department"}
        description={`${selected?.employeeCount ?? 0} members`}
      >
        {selected ? (
          <div className="flex flex-col gap-3 text-left max-h-[360px] overflow-y-auto">
            {selected.members.map((member) => (
              <div
                key={member.employeeId}
                className="flex items-center gap-3 border border-border rounded-lg p-3"
              >
                <PersonAvatar name={member.name} size={32} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-950 truncate">
                    {member.name}
                  </p>
                  <p className="text-xs text-zinc-500 truncate">
                    {member.jobTitle} · {member.employeeId}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
