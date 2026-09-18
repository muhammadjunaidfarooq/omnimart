"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Tags, Power, PowerOff, DollarSign, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Combobox } from "@/components/ui/combobox";
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
import { API_URL, type Brand, type Category } from "@/lib/catalog";
import { inputToCents } from "@/lib/money";

interface Props {
  selectedIds: string[];
  categories: Category[];
  brands: Brand[];
  onDone: () => void;
}

async function postJson(path: string, body: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    throw new Error(errBody?.message ?? "Bulk action failed.");
  }
  return res.json();
}

export function ProductsBulkActions({ selectedIds, categories, brands, onDone }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
      <span className="text-sm font-medium">{selectedIds.length} selected</span>
      <div className="ml-auto flex flex-wrap gap-2">
        <BulkCategoryDialog ids={selectedIds} categories={categories} brands={brands} onDone={onDone} />
        <BulkStatusButtons ids={selectedIds} onDone={onDone} />
        <BulkPriceDialog ids={selectedIds} onDone={onDone} />
        <BulkDeleteDialog ids={selectedIds} onDone={onDone} />
      </div>
    </div>
  );
}

function BulkCategoryDialog({
  ids,
  categories,
  brands,
  onDone,
}: {
  ids: string[];
  categories: Category[];
  brands: Brand[];
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryId && !brandId) {
      toast.error("Pick a category or a brand to apply.");
      return;
    }
    setIsSubmitting(true);
    try {
      const data: { updated: number } = await postJson("/products/bulk/category", {
        ids,
        categoryId: categoryId || undefined,
        brandId: brandId || undefined,
      });
      toast.success(`Updated ${data.updated} product(s).`);
      setOpen(false);
      setCategoryId("");
      setBrandId("");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk update failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant="outline" size="sm">
          <Tags className="size-4" />
          Category / Brand
        </Button>
      }
      title="Change Category / Brand"
      description={`Applies to ${ids.length} selected product(s). Leave a field blank to leave it unchanged.`}
      footer={
        <Button form="bulk-category-form" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Applying…" : "Apply"}
        </Button>
      }
    >
      <form id="bulk-category-form" onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="bulk-category">Category</Label>
          <Combobox
            id="bulk-category"
            value={categoryId}
            onValueChange={setCategoryId}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Leave unchanged"
            searchPlaceholder="Search categories…"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="bulk-brand">Brand</Label>
          <Combobox
            id="bulk-brand"
            value={brandId}
            onValueChange={setBrandId}
            options={brands.map((b) => ({ value: b.id, label: b.name }))}
            placeholder="Leave unchanged"
            searchPlaceholder="Search brands…"
          />
        </div>
      </form>
    </Modal>
  );
}

function BulkStatusButtons({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function apply(isActive: boolean) {
    setIsSubmitting(true);
    try {
      const data: { updated: number } = await postJson("/products/bulk/status", { ids, isActive });
      toast.success(`${isActive ? "Activated" : "Deactivated"} ${data.updated} product(s).`);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk update failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" disabled={isSubmitting} onClick={() => apply(true)}>
        <Power className="size-4" />
        Activate
      </Button>
      <Button variant="outline" size="sm" disabled={isSubmitting} onClick={() => apply(false)}>
        <PowerOff className="size-4" />
        Deactivate
      </Button>
    </>
  );
}

type PriceMode = "SET" | "PERCENT" | "AMOUNT";

function BulkPriceDialog({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PriceMode>("SET");
  const [value, setValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const numericValue = mode === "PERCENT" ? Number.parseFloat(value) : inputToCents(value);
    if (!Number.isFinite(numericValue)) {
      toast.error("Enter a valid value.");
      return;
    }
    setIsSubmitting(true);
    try {
      const data: { updated: number } = await postJson("/products/bulk/price", {
        ids,
        mode,
        value: numericValue,
      });
      toast.success(`Re-priced ${data.updated} product(s).`);
      setOpen(false);
      setValue("");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk price update failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant="outline" size="sm">
          <DollarSign className="size-4" />
          Price
        </Button>
      }
      title="Adjust Selling Price"
      description={`Applies to ${ids.length} selected product(s). Only affects the product's list price — batches already in stock keep selling at whatever price they were received at.`}
      footer={
        <Button form="bulk-price-form" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Applying…" : "Apply"}
        </Button>
      }
    >
      <form id="bulk-price-form" onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="bulk-price-mode">Mode</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as PriceMode)}>
            <SelectTrigger id="bulk-price-mode" className="w-full">
              <SelectValue>
                {(v: string) =>
                  v === "SET" ? "Set new price" : v === "PERCENT" ? "Change by %" : "Change by amount"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SET">Set new price</SelectItem>
              <SelectItem value="PERCENT">Change by %</SelectItem>
              <SelectItem value="AMOUNT">Change by amount</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="bulk-price-value">
            {mode === "PERCENT" ? "Percent (e.g. 10 or -15)" : "Amount"}
          </Label>
          <Input
            id="bulk-price-value"
            type="number"
            step={mode === "PERCENT" ? "0.1" : "0.01"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={mode === "PERCENT" ? "e.g. 10" : "e.g. 199.99"}
            required
          />
        </div>
      </form>
    </Modal>
  );
}

function BulkDeleteDialog({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleDelete() {
    setIsSubmitting(true);
    try {
      const data: { deletedCount: number; skipped: { id: string; name: string }[] } = await postJson(
        "/products/bulk/delete",
        { ids },
      );
      if (data.skipped.length > 0) {
        toast.success(
          `${data.deletedCount} deleted. ${data.skipped.length} skipped (sales/stock history): ${data.skipped
            .map((s) => s.name)
            .join(", ")}`,
        );
      } else {
        toast.success(`${data.deletedCount} product(s) deleted.`);
      }
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk delete failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
            <Trash2 className="size-4" />
            Delete
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {ids.length} product(s)?</AlertDialogTitle>
          <AlertDialogDescription>
            This can&apos;t be undone. Products with sales or stock history can&apos;t be deleted and
            will be skipped — deactivate those instead.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={isSubmitting}
            onClick={handleDelete}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
