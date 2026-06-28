/** Default page size for compact selectable lists (extras, pickers, etc.). */
export const DEFAULT_PAGE_SIZE = 8;

export type PaginatedSlice<T> = {
  items: T[];
  page: number;
  totalPages: number;
  total: number;
  from: number;
  to: number;
};

export function paginateItems<T>(
  items: T[],
  page: number,
  pageSize: number = DEFAULT_PAGE_SIZE,
): PaginatedSlice<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    page: safePage,
    totalPages,
    total,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + pageSize, total),
  };
}
