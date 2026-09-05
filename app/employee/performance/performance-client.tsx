"use client";

import { useState, useTransition } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  acknowledgePerformanceReviewAction,
  updateMyGoalProgressAction,
} from "@/lib/actions/performance";
import type { PerformanceReviewItem } from "@/lib/performance/types";

const STATUS_LABEL = {
  draft: "Draft",
  submitted: "Submitted",
  acknowledged: "Acknowledged",
} as const;

export function EmployeePerformanceClient({ initial }: { initial: PerformanceReviewItem[] }) {
  const [reviews, setReviews] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});

  function updateProgress(reviewId: string, goalId: string, progress: number) {
    startTransition(async () => {
      const result = await updateMyGoalProgressAction({ goalId, progress });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setReviews((prev) =>
        prev.map((review) =>
          review.id === reviewId
            ? {
                ...review,
                goals: review.goals.map((goal) => (goal.id === goalId ? result.data : goal)),
                goalsOnTrack: review.goals
                  .map((goal) => (goal.id === goalId ? result.data : goal))
                  .filter((goal) => goal.progress >= 50).length,
              }
            : review,
        ),
      );
    });
  }

  function acknowledge(reviewId: string) {
    startTransition(async () => {
      const result = await acknowledgePerformanceReviewAction({
        reviewId,
        employeeComments: comments[reviewId] ?? "",
      });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setReviews((prev) => prev.map((row) => (row.id === result.data.id ? result.data : row)));
      setMessage("Review acknowledged.");
    });
  }

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      <div>
        <h1 className="text-h1 font-medium">My Performance</h1>
        <p className="text-body-lg text-zinc-500 font-medium">
          Your submitted reviews, goals, and ratings.
        </p>
      </div>
      {message ? <p className="text-sm font-medium text-zinc-600">{message}</p> : null}
      {reviews.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl py-16 text-center text-sm font-medium text-zinc-400">
          No submitted reviews yet.
        </div>
      ) : (
        reviews.map((review) => (
          <div key={review.id} className="border border-border rounded-xl p-5 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-h3 font-semibold text-zinc-900">{review.cycleName}</h2>
                <p className="text-sm font-medium text-zinc-500">{review.periodLabel}</p>
              </div>
              <StatusBadge status={STATUS_LABEL[review.status]} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="border border-border rounded-lg p-3">
                <p className="text-xs font-semibold text-zinc-500 uppercase">Rating</p>
                <p className="text-h1 font-semibold mt-1">
                  {review.overallRating == null ? "—" : `${review.overallRating.toFixed(1)} / 5`}
                </p>
              </div>
              <div className="border border-border rounded-lg p-3">
                <p className="text-xs font-semibold text-zinc-500 uppercase">Reviewer</p>
                <p className="text-sm font-semibold mt-2">{review.reviewerName ?? "HR"}</p>
              </div>
              <div className="border border-border rounded-lg p-3">
                <p className="text-xs font-semibold text-zinc-500 uppercase">Goals on track</p>
                <p className="text-sm font-semibold mt-2">
                  {review.goalsOnTrack}/{review.goals.length}
                </p>
              </div>
            </div>
            {review.summary ? (
              <p className="text-sm text-zinc-700 font-medium">{review.summary}</p>
            ) : null}
            <div className="flex flex-col gap-3">
              {review.goals.map((goal) => (
                <div key={goal.id} className="border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-zinc-950">{goal.title}</p>
                    <span className="text-xs font-semibold text-zinc-500">{goal.progress}%</span>
                  </div>
                  {goal.description ? (
                    <p className="text-sm text-zinc-500 mt-1">{goal.description}</p>
                  ) : null}
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={goal.progress}
                    disabled={pending || review.status === "acknowledged"}
                    onChange={(event) => updateProgress(review.id, goal.id, Number(event.target.value))}
                    className="w-full mt-2"
                  />
                </div>
              ))}
            </div>
            {review.status === "submitted" ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={comments[review.id] ?? review.employeeComments}
                  onChange={(event) =>
                    setComments((prev) => ({ ...prev, [review.id]: event.target.value }))
                  }
                  rows={3}
                  placeholder="Optional comment for your reviewer"
                  className="px-3 py-2 border border-border rounded-lg text-sm"
                />
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => acknowledge(review.id)}
                  className="cursor-pointer h-10 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-98 disabled:opacity-50"
                >
                  Acknowledge review
                </button>
              </div>
            ) : null}
          </div>
        ))
      )}
    </div>
  );
}
