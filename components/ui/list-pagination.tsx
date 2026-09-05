"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/utils/cn";

/** Pass `resetKey` (search/filters) so page resets without depending on array identity. */
export function useClientPagination<T>(items: T[], pageSize = 20, resetKey?: string | number) {
  const [page, setPage] = useState(1);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    setPage(1);
  }, [resetKey, pageSize, total]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  return { page, setPage, pageSize, total, totalPages, pageItems };
}

export function ListPagination({
  page,
  totalPages,
  total,
  pageItemCount,
  onPageChange,
  className,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageItemCount: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  if (total <= 0) return null;
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <p className="text-xs font-semibold text-zinc-500">
        Showing {pageItemCount} of {total}
        {totalPages > 1 ? ` · page ${page}/${totalPages}` : null}
      </p>
      {totalPages > 1 ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="cursor-pointer h-9 px-3 rounded-lg border border-border text-xs font-semibold disabled:opacity-40 inline-flex items-center gap-1 hover:bg-surface-hover"
          >
            <ChevronLeft className="size-3.5" />
            Prev
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="cursor-pointer h-9 px-3 rounded-lg border border-border text-xs font-semibold disabled:opacity-40 inline-flex items-center gap-1 hover:bg-surface-hover"
          >
            Next
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
