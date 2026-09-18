import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import type { SortOrder } from "@/lib/use-sort";

export interface DataTableColumn<T> {
  header: React.ReactNode;
  headerClassName?: string;
  cell: (row: T) => React.ReactNode;
  cellClassName?: string;
  /** Enables a clickable sort toggle on this column's header — the key passed to onSortChange/DataTable's sortBy. */
  sortKey?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[] | undefined;
  isLoading?: boolean;
  emptyMessage?: string;
  keyExtractor: (row: T) => string;
  skeletonRows?: number;
  /** The currently active sortKey, if any column is sortable. */
  sortBy?: string;
  sortOrder?: SortOrder;
  /** Called with a column's sortKey when its header is clicked. */
  onSortChange?: (sortKey: string) => void;
}

export function DataTable<T>({
  columns,
  rows,
  isLoading = false,
  emptyMessage = "No results found.",
  keyExtractor,
  skeletonRows = 6,
  sortBy,
  sortOrder,
  onSortChange,
}: DataTableProps<T>) {
  return (
    <div className="rounded-xl border bg-card overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col, i) => (
              <TableHead key={i} className={col.headerClassName}>
                {col.sortKey && onSortChange ? (
                  <button
                    type="button"
                    onClick={() => onSortChange(col.sortKey!)}
                    className="inline-flex items-center gap-1 hover:text-foreground/80"
                  >
                    {col.header}
                    {sortBy === col.sortKey ? (
                      sortOrder === "desc" ? (
                        <ArrowDown className="size-3.5" />
                      ) : (
                        <ArrowUp className="size-3.5" />
                      )
                    ) : (
                      <ArrowUpDown className="size-3.5 text-muted-foreground/50" />
                    )}
                  </button>
                ) : (
                  col.header
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: skeletonRows }).map((_, i) => (
              <TableRow key={i}>
                {columns.map((_, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : !rows || rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="py-12 text-center text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={keyExtractor(row)}>
                {columns.map((col, i) => (
                  <TableCell key={i} className={col.cellClassName}>
                    {col.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
