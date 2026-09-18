import { useMemo, useState } from "react";

export type SortOrder = "asc" | "desc";

/**
 * Shared click-to-sort toggle: clicking a new column selects it ascending;
 * clicking the already-active column flips its direction. Used directly by
 * server-paginated listings (the sort state drives the fetch's query params)
 * and internally by useSortedRows for listings sorted client-side.
 */
export function useSortState(initialSortBy: string, initialSortOrder: SortOrder = "asc") {
  const [sortBy, setSortBy] = useState(initialSortBy);
  const [sortOrder, setSortOrder] = useState<SortOrder>(initialSortOrder);

  function handleSortChange(key: string) {
    if (key === sortBy) {
      setSortOrder((order) => (order === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortOrder("asc");
    }
  }

  return { sortBy, sortOrder, setSortBy, setSortOrder, handleSortChange };
}

/**
 * Sorts a fully-loaded row list client-side by whichever column is active —
 * for listings that fetch everything up front rather than paginating
 * server-side. `accessors` maps each sortable column's key to the value to
 * compare; a row whose value is null/undefined always sorts last.
 */
export function useSortedRows<T>(
  rows: T[] | undefined,
  accessors: Record<string, (row: T) => string | number | null | undefined>,
  initialSortBy: string,
  initialSortOrder: SortOrder = "asc",
) {
  const sort = useSortState(initialSortBy, initialSortOrder);
  const accessor = accessors[sort.sortBy];

  const sortedRows = useMemo(() => {
    if (!rows || !accessor) return rows;
    const dir = sort.sortOrder === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string" && typeof bv === "string") {
        return av.localeCompare(bv) * dir;
      }
      return av < bv ? -dir : av > bv ? dir : 0;
    });
  }, [rows, accessor, sort.sortOrder]);

  return { ...sort, sortedRows };
}
