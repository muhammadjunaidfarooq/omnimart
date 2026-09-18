"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import {
  deleteExpense,
  EXPENSE_CATEGORY_LABELS,
  expensesKeys,
  fetchExpenseSummary,
  fetchExpenses,
  type Expense,
  type ExpenseCategory,
} from "@/lib/expenses";
import { formatMoney } from "@/lib/money";
import { useCurrencySymbol } from "@/lib/settings";
import { useSortState } from "@/lib/use-sort";
import { ExpenseFormDialog } from "./expense-form-dialog";
import { ExpenseSummaryCards } from "./expense-summary-cards";

const PAGE_SIZE = 20;
const ALL_CATEGORIES = "all";

export function ExpensesTable() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const currencySymbol = useCurrencySymbol();
  const { sortBy, sortOrder, handleSortChange } = useSortState("date", "desc");

  const filterParams = {
    from: from || undefined,
    to: to || undefined,
    category: category === ALL_CATEGORIES ? undefined : (category as ExpenseCategory),
  };

  const { data: summary } = useQuery({
    queryKey: expensesKeys.summary({ from: filterParams.from, to: filterParams.to }),
    queryFn: () => fetchExpenseSummary({ from: filterParams.from, to: filterParams.to }),
  });

  const listParams = { page, pageSize: PAGE_SIZE, sortBy, sortOrder, ...filterParams };
  const { data, isLoading, isFetching } = useQuery({
    queryKey: expensesKeys.list(listParams),
    queryFn: () => fetchExpenses(listParams),
    placeholderData: (prev) => prev,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onSuccess: () => {
      toast.success("Expense deleted.");
      queryClient.invalidateQueries({ queryKey: expensesKeys.all });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const expenses = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function resetToFirstPage() {
    setPage(1);
  }

  function handleSort(key: string) {
    resetToFirstPage();
    handleSortChange(key);
  }

  const columns: DataTableColumn<Expense>[] = [
    {
      header: "Date",
      sortKey: "date",
      cell: (e) => new Date(e.date).toLocaleDateString(),
    },
    {
      header: "Category",
      sortKey: "category",
      cell: (e) => EXPENSE_CATEGORY_LABELS[e.category],
    },
    {
      header: "Description",
      cell: (e) => <span className="text-muted-foreground">{e.description || "—"}</span>,
    },
    {
      header: "Amount",
      sortKey: "amount",
      headerClassName: "text-right",
      cellClassName: "text-right font-medium",
      cell: (e) => formatMoney(e.amount, currencySymbol),
    },
    {
      header: "Logged by",
      sortKey: "createdBy",
      cell: (e) => e.createdBy.name,
    },
    {
      header: "Actions",
      headerClassName: "text-right",
      cellClassName: "text-right",
      cell: (e) => (
        <div className="flex justify-end gap-1">
          <ExpenseFormDialog expense={e} />
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label="Delete expense">
                  <Trash2 className="size-4" />
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
                <AlertDialogDescription>This can&apos;t be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-white hover:bg-destructive/90"
                  onClick={() => deleteMutation.mutate(e.id)}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {summary && <ExpenseSummaryCards summary={summary} filtered={Boolean(from || to)} />}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="expense-from">From</Label>
            <Input
              id="expense-from"
              type="date"
              className="w-40"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                resetToFirstPage();
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="expense-to">To</Label>
            <Input
              id="expense-to"
              type="date"
              className="w-40"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                resetToFirstPage();
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="expense-category-filter">Category</Label>
            <Select
              value={category}
              onValueChange={(v) => {
                setCategory(v ?? ALL_CATEGORIES);
                resetToFirstPage();
              }}
            >
              <SelectTrigger id="expense-category-filter" className="w-48">
                <SelectValue>
                  {(v: string) =>
                    v === ALL_CATEGORIES
                      ? "All categories"
                      : EXPENSE_CATEGORY_LABELS[v as ExpenseCategory]
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CATEGORIES}>All categories</SelectItem>
                {(Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]).map((c) => (
                  <SelectItem key={c} value={c}>
                    {EXPENSE_CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <ExpenseFormDialog />
      </div>

      {isLoading && !data ? (
        <DataTable
          columns={columns}
          rows={undefined}
          isLoading
          emptyMessage="No expenses found."
          keyExtractor={(e) => e.id}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={handleSort}
        />
      ) : (
        <div className={`transition-opacity ${isFetching ? "opacity-70" : ""}`}>
          <DataTable
            columns={columns}
            rows={expenses}
            isLoading={false}
            emptyMessage="No expenses found."
            keyExtractor={(e) => e.id}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={handleSort}
          />
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} of {totalPages} ({total} expenses)
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
