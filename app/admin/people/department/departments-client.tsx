"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";
import { Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { Modal } from "@/components/ui/modal";
import { ListPagination } from "@/components/ui/list-pagination";
import { toast } from "sonner";
import {
  createDepartmentAction,
  deleteDepartmentAction,
  listDepartmentMembers,
  moveEmployeeDepartmentAction,
  renameDepartmentAction,
  type DepartmentListItem,
  type DepartmentMember,
} from "@/lib/actions/people/departments";

export function DepartmentsClient({
  initialDepartments,
}: {
  initialDepartments: DepartmentListItem[];
}) {
  const [departments, setDepartments] = useState(initialDepartments);
  const [search, setSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [memberPage, setMemberPage] = useState(1);
  const [memberTotal, setMemberTotal] = useState(0);
  const [memberTotalPages, setMemberTotalPages] = useState(1);
  const [sheetMembers, setSheetMembers] = useState<DepartmentMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [selected, setSelected] = useState<DepartmentListItem | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [renameTarget, setRenameTarget] = useState<DepartmentListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DepartmentListItem | null>(null);
  const [pending, startTransition] = useTransition();

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

  const moveTargets = useMemo(() => {
    if (!selected) return [];
    return departments.filter((dept) => dept.id !== selected.id);
  }, [departments, selected]);

  async function loadMembers(departmentId: string, page: number, q: string) {
    setMembersLoading(true);
    const result = await listDepartmentMembers({
      departmentId,
      page,
      pageSize: 20,
      search: q || undefined,
    });
    setMembersLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setSheetMembers(result.data.rows);
    setMemberPage(result.data.page);
    setMemberTotal(result.data.total);
    setMemberTotalPages(result.data.totalPages);
  }

  useEffect(() => {
    if (!selected) {
      setMemberSearch("");
      setMemberPage(1);
      setSheetMembers([]);
      return;
    }
    const handle = window.setTimeout(() => {
      void loadMembers(selected.id, 1, memberSearch);
    }, 250);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce search / open
  }, [selected?.id, memberSearch]);

  function openDepartment(dept: DepartmentListItem) {
    setSelected(dept);
    setMemberSearch("");
    setSheetMembers(dept.members);
    setMemberTotal(dept.employeeCount);
    setMemberTotalPages(Math.max(1, Math.ceil(dept.employeeCount / 20)));
    setMemberPage(1);
  }

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await createDepartmentAction({
        name: String(form.get("name") ?? ""),
        code: String(form.get("code") ?? "") || undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setDepartments((prev) =>
        [...prev, result.data].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setShowCreate(false);
      toast.success(`Created ${result.data.name}.`);
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
        toast.error(result.error);
        return;
      }
      setDepartments((prev) =>
        prev
          .map((dept) => (dept.id === result.data.id ? result.data : dept))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      if (selected?.id === result.data.id) setSelected(result.data);
      setRenameTarget(null);
      toast.success(`Renamed to ${result.data.name}.`);
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteDepartmentAction({ id: deleteTarget.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setDepartments((prev) => prev.filter((dept) => dept.id !== result.data.id));
      if (selected?.id === result.data.id) setSelected(null);
      setDeleteTarget(null);
      toast.success("Department deleted.");
    });
  }

  function handleMoveEmployee(employeeId: string, departmentId: string) {
    if (!departmentId || !selected) return;
    startTransition(async () => {
      const result = await moveEmployeeDepartmentAction({ employeeId, departmentId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const { fromDepartmentId, toDepartmentId, member } = result.data;
      const targetName =
        departments.find((dept) => dept.id === toDepartmentId)?.name ?? "new department";
      setDepartments((prev) =>
        prev.map((dept) => {
          if (dept.id === fromDepartmentId) {
            return {
              ...dept,
              employeeCount: Math.max(0, dept.employeeCount - 1),
              members: dept.members.filter((row) => row.employeeId !== member.employeeId),
            };
          }
          if (dept.id === toDepartmentId) {
            const members = [...dept.members, member]
              .sort((a, b) => a.name.localeCompare(b.name))
              .slice(0, 5);
            return {
              ...dept,
              employeeCount: dept.employeeCount + 1,
              members,
            };
          }
          return dept;
        }),
      );
      setSelected((prev) =>
        prev && prev.id === fromDepartmentId
          ? { ...prev, employeeCount: Math.max(0, prev.employeeCount - 1) }
          : prev,
      );
      void loadMembers(fromDepartmentId, memberPage, memberSearch);
      toast.success(`Moved ${member.name} to ${targetName}.`);
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
                onClick={() => openDepartment(dept)}
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
              <div className="mt-4 pt-3 border-t border-border flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setRenameTarget(dept)}
                  className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-950"
                >
                  <Pencil className="size-3.5" />
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(dept)}
                  className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700"
                >
                  <Trash2 className="size-3.5" />
                  Delete
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
        className="max-w-2xl"
      >
        {selected ? (
          <div className="flex flex-col gap-3 text-left">
            <div className="relative">
              <Search className="absolute left-2 top-1.5 size-3.5 text-zinc-400 pointer-events-none" />
              <input
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search people…"
                className="w-full h-7 pl-7 pr-2 border border-border rounded-md text-[11px] bg-surface focus:outline-none focus:border-border-strong"
              />
            </div>
            <div className="flex flex-col gap-2 max-h-[480px] overflow-y-auto pr-1">
              {membersLoading && sheetMembers.length === 0 ? (
                <p className="text-sm text-zinc-500">Loading members…</p>
              ) : sheetMembers.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  {memberSearch.trim() ? "No people match these filters." : "No members assigned yet."}
                </p>
              ) : (
                sheetMembers.map((member) => (
                  <div
                    key={member.employeeId}
                    className="flex items-center gap-3 border border-border rounded-lg px-3 py-2"
                  >
                    <PersonAvatar name={member.name} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-zinc-950 truncate">
                        {member.name}
                      </p>
                      <p className="text-xs text-zinc-500 truncate">
                        {member.jobTitle} · {member.employeeId}
                      </p>
                    </div>
                    <select
                      aria-label={`Move ${member.name}`}
                      disabled={pending || moveTargets.length === 0}
                      defaultValue=""
                      key={`${member.employeeId}-${selected.id}-${memberTotal}`}
                      onChange={(e) => {
                        const nextDept = e.target.value;
                        e.target.value = "";
                        handleMoveEmployee(member.employeeId, nextDept);
                      }}
                      className="h-7 max-w-[9rem] shrink-0 px-1.5 border border-border rounded-md text-[11px] font-semibold text-zinc-700 bg-surface focus:outline-none focus:border-border-strong disabled:opacity-50"
                    >
                      <option value="" disabled>
                        Move to…
                      </option>
                      {moveTargets.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))
              )}
            </div>
            <ListPagination
              page={memberPage}
              totalPages={memberTotalPages}
              total={memberTotal}
              pageItemCount={sheetMembers.length}
              onPageChange={(nextPage) => {
                void loadMembers(selected.id, nextPage, memberSearch);
              }}
            />
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

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete department"
        description={
          deleteTarget
            ? deleteTarget.employeeCount > 0
              ? `${deleteTarget.name} has ${deleteTarget.employeeCount} employee(s). Reassign them before deleting.`
              : `Permanently remove ${deleteTarget.name} (${deleteTarget.code}).`
            : undefined
        }
      >
        {deleteTarget ? (
          <div className="flex flex-col gap-4 text-left">
            {deleteTarget.employeeCount > 0 ? (
              <p className="text-sm text-zinc-600">
                Move people to another department first, then try again.
              </p>
            ) : (
              <p className="text-sm text-zinc-600">
                This cannot be undone. Linked contracts will clear this department reference.
              </p>
            )}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="cursor-pointer h-10 px-3 rounded-lg border border-border bg-surface hover:bg-surface-hover text-sm font-semibold text-zinc-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending || deleteTarget.employeeCount > 0}
                onClick={handleDelete}
                className="cursor-pointer h-10 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-sm font-semibold text-white shadow-2xs active:scale-98 disabled:opacity-60"
              >
                {pending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
