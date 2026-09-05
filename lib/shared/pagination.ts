export const DEFAULT_LIST_PAGE_SIZE = 20;
export const MAX_LIST_PAGE_SIZE = 60;

export function clampPageSize(
  value: number | undefined,
  fallback = DEFAULT_LIST_PAGE_SIZE,
  max = MAX_LIST_PAGE_SIZE,
) {
  if (!value || Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(1, Math.floor(value)));
}

export function clampPage(value: number | undefined) {
  if (!value || Number.isNaN(value) || value < 1) return 1;
  return Math.floor(value);
}

export function pageSkip(page: number, pageSize: number) {
  return (page - 1) * pageSize;
}

export function totalPagesFor(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(total / pageSize));
}

export type PagedResult<T> = {
  rows: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
