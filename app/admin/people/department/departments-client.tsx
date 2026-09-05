"use client";

import React, { useMemo, useState, useTransition } from "react";
import { Pencil, Plus, Search, Users } from "lucide-react";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { Modal } from "@/components/ui/modal";
import { Toast } from "@/components/ui/toast";
import {
  createDepartmentAction,
  renameDepartmentAction,
  type DepartmentListItem,
} from "@/lib/actions/departments";

export function DepartmentsClient({
  initialDepartments,
}: {
  initialDepartments: DepartmentListItem[];
}) {
  const [departments, setDepartments] = useState(initialDepartments);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<DepartmentListItem | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [renameTarget, setRenameTarget] = useState<DepartmentListItem | null>(null);
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(
    null,
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return departments;
    return departments.filter(
      (dept) =>
        dept.name.toLowerCase().includes(q) ||
        dept.code.toLowerCase().includes(q) ||
        dept.managerName.toLowerCase().includes(q),
    );
  }, [departments, search]);

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await createDepartmentAction({
        name: String(form.get("name") ?? ""),
        code: String(form.get("code") ?? "") || undefined,
      });
      if (!result.ok) {
        setToast({ message: result.error, type: "error" });
        return;
      }
      setDepartments((prev) =>
        [...prev, result.data].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setShowCreate(false);
      setToast({ message: `Created ${result.data.name}.`, type: "success" });
    });
  }

  function handleRename(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!renameTarget) return;
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await renameDepartmentAction({
        id: renameTarget.id,
        name: String(form.get("name") ?? ""),
      });
      if (!result.ok) {
        setToast({ message: result.error, type: "error" });
        return;
      }
      setDepartments((prev) =>
        prev
          .map((dept) => (dept.id === result.data.id ? result.data : dept))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      if (selected?.id === result.data.id) setSelected(result.data);
      setRenameTarget(null);
      setToast({ message: `Renamed to ${result.data.name}.`, type: "success" });
    });
  }

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-h1 font-medium">Departments</h1>
          <p className="text-body-lg text-zinc-500 font-medium">
            Persist org units employees and contracts will select.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="cursor-pointer flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-98 transition-all"
        >
          <Plus className="size-4" />
          Add department
        </button>
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

      {filtered.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl py-16 text-center text-sm text-zinc-400 font-medium">
          No departments yet. Create one to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((dept) => (
            <div
              key={dept.id}
              className="border border-border rounded-xl p-5 bg-surface hover:border-border-strong transition-colors duration-150"
            >
              <button
                type="button"
                onClick={() => setSelected(dept)}
                className="cursor-pointer w-full text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-zinc-950">{dept.name}</h2>
                    <p className="text-[11px] font-semibold text-zinc-400 mt-0.5">
                      {dept.code}
                    </p>
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
              <div className="mt-4 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setRenameTarget(dept)}
                  className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-950"
                >
                  <Pencil className="size-3.5" />
                  Rename
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.name ?? "Department"}
        description={`${selected?.employeeCount ?? 0} members · ${selected?.code ?? ""}`}
      >
        {selected ? (
          <div className="flex flex-col gap-3 text-left max-h-[360px] overflow-y-auto">
            {selected.members.length === 0 ? (
              <p className="text-sm text-zinc-500">No members assigned yet.</p>
            ) : (
              selected.members.map((member) => (
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
              ))
            )}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Add department"
        description="Code is derived from the name if left blank."
      >
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-left">
            <span className="text-xs font-semibold text-zinc-500">Name</span>
            <input
              name="name"
              required
              className="h-10 px-3 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong"
              placeholder="Engineering"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-left">
            <span className="text-xs font-semibold text-zinc-500">Code (optional)</span>
            <input
              name="code"
              className="h-10 px-3 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong"
              placeholder="ENGINEERING"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="cursor-pointer mt-2 h-10 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-98 disabled:opacity-60"
          >
            {pending ? "Saving…" : "Create"}
          </button>
        </form>
      </Modal>

      <Modal
        open={Boolean(renameTarget)}
        onClose={() => setRenameTarget(null)}
        title="Rename department"
        description={renameTarget?.code}
      >
        <form onSubmit={handleRename} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-left">
            <span className="text-xs font-semibold text-zinc-500">Name</span>
            <input
              key={renameTarget?.id}
              name="name"
              required
              defaultValue={renameTarget?.name}
              className="h-10 px-3 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="cursor-pointer mt-2 h-10 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-98 disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </form>
      </Modal>

      {toast ? (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      ) : null}
    </div>
  );
}
