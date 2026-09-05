"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/utils/cn";
import {
  closePerformanceCycleAction,
  createPerformanceReviewAction,
  deletePerformanceReviewAction,
  getPerformanceBoard,
  savePerformanceReviewAction,
  submitPerformanceReviewAction,
  upsertPerformanceCycleAction,
} from "@/lib/actions/performance";
import type { PerformanceBoard, PerformanceReviewItem } from "@/lib/performance/types";

const inputClass =
  "h-10 px-3 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong";

const STATUS_LABEL: Record<PerformanceReviewItem["status"], string> = {
  draft: "Draft",
  submitted: "Submitted",
  acknowledged: "Acknowledged",
};

type GoalDraft = { title: string; description: string; progress: number };

const emptyGoal = (): GoalDraft => ({ title: "", description: "", progress: 0 });

export function PerformanceClient({ initial }: { initial: PerformanceBoard }) {
  const [board, setBoard] = useState(initial);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [cycleFilter, setCycleFilter] = useState("All");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [cycleOpen, setCycleOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [editing, setEditing] = useState<PerformanceReviewItem | null>(null);
  const [goals, setGoals] = useState<GoalDraft[]>([emptyGoal()]);
  const [rating, setRating] = useState("3");
  const [summary, setSummary] = useState("");

  const openCycles = board.cycles.filter((cycle) => cycle.status === "open");

  const filtered = board.reviews.filter((row) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      row.employeeName.toLowerCase().includes(q) ||
      row.employeeCode.toLowerCase().includes(q) ||
      row.department.toLowerCase().includes(q);
    const matchesStatus = status === "All" || row.status === status;
    const matchesCycle = cycleFilter === "All" || row.cycleId === cycleFilter;
    return matchesSearch && matchesStatus && matchesCycle;
  });

  const maxPie = useMemo(
    () => board.ratingDistribution.some((row) => row.value > 0),
    [board.ratingDistribution],
  );

  function refreshFrom(next: PerformanceBoard) {
    setBoard(next);
  }

  function createCycle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await upsertPerformanceCycleAction({
        name: String(form.get("name") ?? ""),
        periodStart: String(form.get("periodStart") ?? ""),
        periodEnd: String(form.get("periodEnd") ?? ""),
        seedEmployees: form.get("seedEmployees") === "on",
      });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      const boardResult = await getPerformanceBoard();
      if (boardResult.ok) refreshFrom(boardResult.data);
      setCycleOpen(false);
      setMessage(`Created ${result.data.name}.`);
    });
  }

  function createReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await createPerformanceReviewAction({
        cycleId: String(form.get("cycleId") ?? ""),
        employeeId: String(form.get("employeeId") ?? ""),
        goals: goals
          .filter((goal) => goal.title.trim().length >= 2)
          .map((goal) => ({
            title: goal.title,
            description: goal.description,
            progress: goal.progress,
          })),
      });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setBoard((prev) => ({
        ...prev,
        reviews: [result.data, ...prev.reviews.filter((row) => row.id !== result.data.id)],
      }));
      setReviewOpen(false);
      setGoals([emptyGoal()]);
      setMessage(`Review started for ${result.data.employeeName}.`);
    });
  }

  function openEditor(row: PerformanceReviewItem) {
    setEditing(row);
    setRating(String(row.overallRating ?? 3));
    setSummary(row.summary);
    setGoals(
      row.goals.length
        ? row.goals.map((goal) => ({
            title: goal.title,
            description: goal.description,
            progress: goal.progress,
          }))
        : [emptyGoal()],
    );
  }

  function saveReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    startTransition(async () => {
      const result = await savePerformanceReviewAction({
        reviewId: editing.id,
        overallRating: Number(rating),
        summary,
        goals: goals
          .filter((goal) => goal.title.trim().length >= 2)
          .map((goal) => ({
            title: goal.title,
            description: goal.description,
            progress: goal.progress,
          })),
      });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setBoard((prev) => ({
        ...prev,
        reviews: prev.reviews.map((row) => (row.id === result.data.id ? result.data : row)),
      }));
      setEditing(null);
      setMessage("Review saved.");
    });
  }

  function submitReview(id: string) {
    startTransition(async () => {
      const result = await submitPerformanceReviewAction(id);
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setBoard((prev) => ({
        ...prev,
        reviews: prev.reviews.map((row) => (row.id === result.data.id ? result.data : row)),
      }));
      setEditing(null);
      setMessage("Review submitted to the employee.");
    });
  }

  function closeCycle(id: string) {
    startTransition(async () => {
      const result = await closePerformanceCycleAction(id);
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setBoard((prev) => ({
        ...prev,
        cycles: prev.cycles.map((cycle) =>
          cycle.id === id ? { ...cycle, status: "closed" } : cycle,
        ),
      }));
      setMessage("Cycle closed.");
    });
  }

  function removeReview(id: string) {
    if (!window.confirm("Delete this draft review?")) return;
    startTransition(async () => {
      const result = await deletePerformanceReviewAction(id);
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setBoard((prev) => ({
        ...prev,
        reviews: prev.reviews.filter((row) => row.id !== id),
      }));
    });
  }

  const cards = [
    {
      label: "Average rating",
      value: board.stats.avgRating == null ? "—" : board.stats.avgRating.toFixed(1),
      subtext: "Submitted reviews",
    },
    {
      label: "Drafts",
      value: String(board.stats.pendingReviews),
      subtext: "Awaiting submit",
    },
    {
      label: "With employee",
      value: String(board.stats.submittedReviews),
      subtext: "Pending ack",
    },
    {
      label: "Goals on track",
      value: board.stats.goalCount === 0 ? "—" : `${board.stats.goalsOnTrack}/${board.stats.goalCount}`,
      subtext: "Progress ≥ 50%",
    },
  ];

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-h1 font-medium">Performance</h1>
          <p className="text-body-lg text-zinc-500 font-medium">
            Review cycles, ratings, and goals for your workforce.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCycleOpen(true)}
            className="cursor-pointer h-10 px-3.5 rounded-lg border border-border bg-surface hover:bg-surface-hover text-sm font-semibold"
          >
            New cycle
          </button>
          <button
            type="button"
            onClick={() => {
              setGoals([emptyGoal()]);
              setReviewOpen(true);
            }}
            disabled={openCycles.length === 0}
            className="cursor-pointer h-10 px-3.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-98 disabled:opacity-50 inline-flex items-center gap-2"
          >
            <Plus className="size-4" />
            Add review
          </button>
        </div>
      </div>

      {message ? <p className="text-sm font-medium text-zinc-600">{message}</p> : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="border border-border rounded-xl p-5 bg-surface">
            <p className="text-sm font-medium text-zinc-500">{card.label}</p>
            <p className="text-h1 font-semibold text-zinc-950 mt-2 leading-none">{card.value}</p>
            <p className="text-sm font-medium text-zinc-500 mt-2">{card.subtext}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 border border-border rounded-xl p-5">
          <h2 className="text-h3 font-semibold text-zinc-900 mb-4">Review cycles</h2>
          {board.cycles.length === 0 ? (
            <p className="text-sm font-medium text-zinc-400">No cycles yet. Create one to start reviews.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {board.cycles.map((cycle) => (
                <div
                  key={cycle.id}
                  className="flex items-center justify-between gap-3 border border-border rounded-lg px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-zinc-950">{cycle.name}</p>
                    <p className="text-xs font-medium text-zinc-500">
                      {cycle.periodLabel} · {cycle.reviewCount} review{cycle.reviewCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={cycle.status === "open" ? "Active" : "Inactive"} />
                    {cycle.status === "open" ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => closeCycle(cycle.id)}
                        className="cursor-pointer text-xs font-semibold text-zinc-600 hover:text-zinc-950"
                      >
                        Close
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="lg:col-span-4 border border-border rounded-xl p-5">
          <h2 className="text-h3 font-semibold text-zinc-900 mb-4">Rating mix</h2>
          {!maxPie ? (
            <p className="text-sm font-medium text-zinc-400 py-10 text-center">Ratings appear after reviews are saved.</p>
          ) : (
            <div className="flex items-center gap-4">
              <div className="size-[140px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={board.ratingDistribution}
                      innerRadius={42}
                      outerRadius={62}
                      paddingAngle={4}
                      cornerRadius={6}
                      dataKey="value"
                    >
                      {board.ratingDistribution.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-2">
                {board.ratingDistribution.map((row) => (
                  <div key={row.name} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 text-zinc-700 font-medium">
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: row.color }} />
                      {row.name}
                    </span>
                    <span className="font-semibold text-zinc-950">{row.percentage}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="size-4 absolute left-3 top-3 text-zinc-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search employee"
            className={cn(inputClass, "pl-9 w-full")}
          />
        </div>
        <select value={cycleFilter} onChange={(event) => setCycleFilter(event.target.value)} className={inputClass}>
          <option value="All">All cycles</option>
          {board.cycles.map((cycle) => (
            <option key={cycle.id} value={cycle.id}>
              {cycle.name}
            </option>
          ))}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className={inputClass}>
          <option value="All">All statuses</option>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
          <option value="acknowledged">Acknowledged</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl py-16 text-center text-sm font-medium text-zinc-400">
          No reviews match these filters.
        </div>
      ) : (
        <div className="overflow-x-auto border border-border rounded-xl">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs font-semibold text-zinc-500 uppercase">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Cycle</th>
                <th className="px-4 py-3">Rating</th>
                <th className="px-4 py-3">Goals</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-zinc-950">{row.employeeName}</p>
                    <p className="text-xs text-zinc-500">
                      {row.employeeCode} · {row.department}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{row.cycleName}</td>
                  <td className="px-4 py-3 font-semibold">
                    {row.overallRating == null ? "—" : row.overallRating.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {row.goalsOnTrack}/{row.goals.length} on track
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={STATUS_LABEL[row.status]} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => openEditor(row)}
                        className="cursor-pointer text-xs font-semibold text-zinc-600 hover:text-zinc-950"
                      >
                        {row.status === "draft" ? "Edit" : "View"}
                      </button>
                      {row.status === "draft" ? (
                        <>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => submitReview(row.id)}
                            className="cursor-pointer text-xs font-semibold text-zinc-600 hover:text-zinc-950"
                          >
                            Submit
                          </button>
                          <button
                            type="button"
                            onClick={() => removeReview(row.id)}
                            className="cursor-pointer inline-flex items-center gap-1 text-xs font-semibold text-red-600"
                          >
                            <Trash2 className="size-3.5" />
                            Delete
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={cycleOpen} onClose={() => setCycleOpen(false)} title="New review cycle">
        <form className="flex flex-col gap-3" onSubmit={createCycle}>
          <input name="name" required placeholder="H2 2026 reviews" className={inputClass} />
          <div className="grid grid-cols-2 gap-3">
            <input name="periodStart" type="date" required className={inputClass} />
            <input name="periodEnd" type="date" required className={inputClass} />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
            <input type="checkbox" name="seedEmployees" className="size-4" />
            Create draft reviews for all active employees
          </label>
          <button
            type="submit"
            disabled={pending}
            className="cursor-pointer h-10 rounded-lg bg-zinc-900 text-white text-sm font-semibold disabled:opacity-50"
          >
            {pending ? "Saving…" : "Create cycle"}
          </button>
        </form>
      </Modal>

      <Modal open={reviewOpen} onClose={() => setReviewOpen(false)} title="Add review">
        <form className="flex flex-col gap-3" onSubmit={createReview}>
          <select name="cycleId" required className={inputClass} defaultValue={openCycles[0]?.id}>
            {openCycles.map((cycle) => (
              <option key={cycle.id} value={cycle.id}>
                {cycle.name}
              </option>
            ))}
          </select>
          <select name="employeeId" required className={inputClass}>
            <option value="">Select employee</option>
            {board.employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name} · {employee.department}
              </option>
            ))}
          </select>
          <GoalEditor goals={goals} setGoals={setGoals} />
          <button
            type="submit"
            disabled={pending}
            className="cursor-pointer h-10 rounded-lg bg-zinc-900 text-white text-sm font-semibold disabled:opacity-50"
          >
            {pending ? "Saving…" : "Create review"}
          </button>
        </form>
      </Modal>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? `${editing.employeeName} · ${editing.cycleName}` : "Review"}
      >
        {editing ? (
          <form className="flex flex-col gap-3" onSubmit={saveReview}>
            <label className="text-sm font-medium text-zinc-700">
              Overall rating
              <select
                value={rating}
                onChange={(event) => setRating(event.target.value)}
                disabled={editing.status !== "draft"}
                className={cn(inputClass, "mt-1 w-full")}
              >
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    {value} / 5
                  </option>
                ))}
              </select>
            </label>
            <textarea
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              disabled={editing.status !== "draft"}
              rows={4}
              placeholder="Summary of strengths, gaps, and next steps"
              className="px-3 py-2 border border-border rounded-lg text-sm"
            />
            <GoalEditor goals={goals} setGoals={setGoals} readOnly={editing.status !== "draft"} />
            {editing.employeeComments ? (
              <p className="text-sm text-zinc-600">Employee comment: {editing.employeeComments}</p>
            ) : null}
            {editing.status === "draft" ? (
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="cursor-pointer h-10 flex-1 rounded-lg border border-border text-sm font-semibold disabled:opacity-50"
                >
                  Save draft
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => submitReview(editing.id)}
                  className="cursor-pointer h-10 flex-1 rounded-lg bg-zinc-900 text-white text-sm font-semibold disabled:opacity-50"
                >
                  Submit
                </button>
              </div>
            ) : null}
          </form>
        ) : null}
      </Modal>
    </div>
  );
}

function GoalEditor({
  goals,
  setGoals,
  readOnly = false,
}: {
  goals: GoalDraft[];
  setGoals: (next: GoalDraft[]) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-zinc-800">Goals</p>
      {goals.map((goal, index) => (
        <div key={index} className="border border-border rounded-lg p-3 flex flex-col gap-2">
          <input
            value={goal.title}
            readOnly={readOnly}
            onChange={(event) => {
              const next = [...goals];
              next[index] = { ...goal, title: event.target.value };
              setGoals(next);
            }}
            placeholder="Goal title"
            className={inputClass}
          />
          <input
            value={goal.description}
            readOnly={readOnly}
            onChange={(event) => {
              const next = [...goals];
              next[index] = { ...goal, description: event.target.value };
              setGoals(next);
            }}
            placeholder="Optional detail"
            className={inputClass}
          />
          <label className="text-xs font-semibold text-zinc-500">
            Progress {goal.progress}%
            <input
              type="range"
              min={0}
              max={100}
              value={goal.progress}
              disabled={readOnly}
              onChange={(event) => {
                const next = [...goals];
                next[index] = { ...goal, progress: Number(event.target.value) };
                setGoals(next);
              }}
              className="w-full mt-1"
            />
          </label>
        </div>
      ))}
      {readOnly ? null : (
        <button
          type="button"
          onClick={() => setGoals([...goals, emptyGoal()])}
          className="cursor-pointer text-sm font-semibold text-zinc-700"
        >
          Add goal
        </button>
      )}
    </div>
  );
}
