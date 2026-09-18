"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { centsToInput, inputToCents } from "@/lib/money";
import {
  createExpense,
  EXPENSE_CATEGORY_LABELS,
  expensesKeys,
  updateExpense,
  type Expense,
  type ExpenseCategory,
} from "@/lib/expenses";

const CATEGORIES = Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[];

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function ExpenseFormDialog({ expense }: { expense?: Expense }) {
  const isEdit = Boolean(expense);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<ExpenseCategory>(expense?.category ?? "MISC");
  const [amount, setAmount] = useState(expense ? centsToInput(expense.amount) : "");
  const [description, setDescription] = useState(expense?.description ?? "");
  const [date, setDate] = useState(expense ? expense.date.slice(0, 10) : todayIsoDate());

  function handleOpenChange(next: boolean) {
    if (next) {
      setCategory(expense?.category ?? "MISC");
      setAmount(expense ? centsToInput(expense.amount) : "");
      setDescription(expense?.description ?? "");
      setDate(expense ? expense.date.slice(0, 10) : todayIsoDate());
    }
    setOpen(next);
  }

  const mutation = useMutation({
    mutationFn: () =>
      isEdit
        ? updateExpense(expense!.id, {
            category,
            amount: inputToCents(amount),
            description: description || undefined,
            date,
          })
        : createExpense({
            category,
            amount: inputToCents(amount),
            description: description || undefined,
            date,
          }),
    onSuccess: () => {
      toast.success(isEdit ? "Expense updated." : "Expense added.");
      queryClient.invalidateQueries({ queryKey: expensesKeys.all });
      setOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cents = inputToCents(amount);
    if (!cents || cents < 1) {
      toast.error("Enter a valid amount.");
      return;
    }
    mutation.mutate();
  }

  const formId = `expense-form-${expense?.id ?? "new"}`;

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      trigger={
        isEdit ? (
          <Button variant="ghost" size="icon-sm" aria-label="Edit expense">
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button>
            <Plus className="size-4" />
            New expense
          </Button>
        )
      }
      title={isEdit ? "Edit expense" : "New expense"}
      footer={
        <Button form={formId} type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save"}
        </Button>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="expense-category">Category</Label>
          <Select value={category} onValueChange={(v) => v && setCategory(v as ExpenseCategory)}>
            <SelectTrigger id="expense-category" className="w-full">
              <SelectValue>{(v: string) => EXPENSE_CATEGORY_LABELS[v as ExpenseCategory]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {EXPENSE_CATEGORY_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="expense-amount">Amount</Label>
            <Input
              id="expense-amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="expense-date">Date</Label>
            <Input
              id="expense-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="expense-description">Description (optional)</Label>
          <Textarea
            id="expense-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. July electricity bill"
            rows={2}
          />
        </div>
      </form>
    </Modal>
  );
}
