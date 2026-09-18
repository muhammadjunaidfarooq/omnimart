import type { PaginatedResponse } from "./api";
import type { SortOrder } from "./use-sort";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type ExpenseCategory = "RENT" | "ELECTRICITY" | "INTERNET" | "FUEL" | "MAINTENANCE" | "MISC";

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  RENT: "Rent",
  ELECTRICITY: "Electricity",
  INTERNET: "Internet",
  FUEL: "Fuel",
  MAINTENANCE: "Maintenance",
  MISC: "Miscellaneous",
};

export interface Expense {
  id: string;
  category: ExpenseCategory;
  amount: number;
  description: string | null;
  date: string;
  createdById: string;
  createdBy: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseSummary {
  total: number;
  byCategory: { category: ExpenseCategory; total: number }[];
}

export interface ExpenseQueryParams {
  page: number;
  pageSize: number;
  from?: string;
  to?: string;
  category?: ExpenseCategory;
  sortBy?: string;
  sortOrder?: SortOrder;
}

export interface ExpenseInput {
  category: ExpenseCategory;
  amount: number;
  description?: string;
  date: string;
}

export const expensesKeys = {
  all: ["expenses"] as const,
  list: (params: ExpenseQueryParams) => ["expenses", "list", params] as const,
  summary: (params: Pick<ExpenseQueryParams, "from" | "to">) => ["expenses", "summary", params] as const,
};

async function parseErrorMessage(res: Response, fallback: string) {
  const err = await res.json().catch(() => ({}));
  const message = (err as { message?: string | string[] }).message;
  return Array.isArray(message) ? message.join(", ") : message ?? fallback;
}

function buildQuery<T extends object>(params: T) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, String(value));
  }
  return query;
}

export async function fetchExpenses(params: ExpenseQueryParams): Promise<PaginatedResponse<Expense>> {
  const query = buildQuery(params);
  const res = await fetch(`${API_URL}/expenses?${query}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch expenses");
  return res.json();
}

export async function fetchExpenseSummary(
  params: Pick<ExpenseQueryParams, "from" | "to">,
): Promise<ExpenseSummary> {
  const query = buildQuery(params);
  const res = await fetch(`${API_URL}/expenses/summary?${query}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch expense summary");
  return res.json();
}

export async function createExpense(input: ExpenseInput): Promise<Expense> {
  const res = await fetch(`${API_URL}/expenses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Could not create expense"));
  return res.json();
}

export async function updateExpense(id: string, input: Partial<ExpenseInput>): Promise<Expense> {
  const res = await fetch(`${API_URL}/expenses/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Could not update expense"));
  return res.json();
}

export async function deleteExpense(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/expenses/${id}`, { method: "DELETE", credentials: "include" });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Could not delete expense"));
}
