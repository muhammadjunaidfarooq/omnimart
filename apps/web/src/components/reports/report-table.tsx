"use client";

import Link from "next/link";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { exportToCsv, type CsvColumn } from "@/lib/csv";

export interface ReportColumn<T> {
  header: string;
  cell: (row: T) => React.ReactNode;
  csvValue: (row: T) => string | number;
}

interface Props<T> {
  title: string;
  filename: string;
  columns: ReportColumn<T>[];
  rows: T[] | undefined;
  keyExtractor: (row: T) => string;
  filters?: React.ReactNode;
  emptyMessage?: string;
  /** Link to this report's print-friendly page (opened in a new tab for a PDF via the browser's print dialog) — shows an "Export PDF" button next to Export CSV when given. Omit for reports that don't have one yet. */
  pdfHref?: string;
}

/**
 * The shared report shell described in PLAN.md's Phase 8: columns + filters +
 * CSV export, so each report only supplies data-fetching and column shape.
 */
export function ReportTable<T>({
  title,
  filename,
  columns,
  rows,
  keyExtractor,
  filters,
  emptyMessage,
  pdfHref,
}: Props<T>) {
  const tableColumns: DataTableColumn<T>[] = columns.map((c) => ({
    header: c.header,
    cell: c.cell,
  }));
  const csvColumns: CsvColumn<T>[] = columns.map((c) => ({
    header: c.header,
    accessor: c.csvValue,
  }));

  function handleExport() {
    if (!rows || rows.length === 0) return;
    exportToCsv(filename, csvColumns, rows);
  }

  return (
    <Card className="p-4">
      <CardHeader className="flex flex-row items-center justify-between gap-3 px-0">
        <CardTitle className="text-base">{title}</CardTitle>
        <div className="flex gap-2">
          {pdfHref && (
            <Button
              variant="outline"
              size="sm"
              render={<Link href={pdfHref} target="_blank" />}
              nativeButton={false}
            >
              <Printer className="size-4" />
              Export PDF
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!rows || rows.length === 0}>
            <Download className="size-4" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-0">
        {filters && <div className="flex flex-wrap items-end gap-3">{filters}</div>}
        <DataTable
          columns={tableColumns}
          rows={rows}
          isLoading={rows === undefined}
          emptyMessage={emptyMessage ?? "No data for this range."}
          keyExtractor={keyExtractor}
        />
      </CardContent>
    </Card>
  );
}
