"use client";

import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { Pencil, Plus, Trash2 } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { useSortedRows } from "@/lib/use-sort";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface LookupItem {
  id: string;
  name: string;
  [key: string]: unknown;
}

interface ExtraField {
  key: string;
  label: string;
  placeholder?: string;
  /** "text" (default) renders a plain input and stores a string; "checkbox" renders a Switch and stores a boolean. */
  type?: "text" | "checkbox";
}

function extraFieldDefault(field: ExtraField, item?: LookupItem): string | boolean {
  if (field.type === "checkbox") return Boolean(item?.[field.key]);
  return (item?.[field.key] as string) ?? "";
}

export function LookupManager({
  resourceLabel,
  resourcePath,
  extraFields,
}: {
  resourceLabel: string;
  resourcePath: string;
  extraFields?: ExtraField[];
}) {
  const [items, setItems] = useState<LookupItem[] | null>(null);

  async function load() {
    const res = await fetch(`${API_URL}/${resourcePath}`, { credentials: "include" });
    if (res.ok) {
      setItems(await res.json());
    } else {
      toast.error(`Could not load ${resourceLabel.toLowerCase()}s.`);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount, not a synchronous setState
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourcePath]);

  async function handleDelete(item: LookupItem) {
    const res = await fetch(`${API_URL}/${resourcePath}/${item.id}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.message ?? `Could not delete this ${resourceLabel.toLowerCase()}.`);
      return;
    }

    toast.success(`${resourceLabel} deleted.`);
    load();
  }

  const sortAccessors: Record<string, (item: LookupItem) => string | number | null> = {
    name: (item) => item.name,
    ...Object.fromEntries(
      (extraFields ?? []).map((field) => [
        field.key,
        (item: LookupItem) => (item[field.key] as string) ?? null,
      ]),
    ),
  };
  const { sortedRows: sortedItems, sortBy, sortOrder, handleSortChange } = useSortedRows(
    items ?? undefined,
    sortAccessors,
    "name",
  );

  const columns: DataTableColumn<LookupItem>[] = [
    {
      header: "Name",
      sortKey: "name",
      cell: (item) => <span className="font-medium">{item.name}</span>,
    },
    ...(extraFields ?? []).map(
      (field): DataTableColumn<LookupItem> => ({
        header: field.label,
        sortKey: field.key,
        cell: (item) =>
          field.type === "checkbox" ? (
            item[field.key] ? (
              <Badge variant="secondary">Yes</Badge>
            ) : (
              <span className="text-muted-foreground">—</span>
            )
          ) : (
            <span className="text-muted-foreground">{(item[field.key] as string) || "—"}</span>
          ),
      }),
    ),
    {
      header: "Actions",
      headerClassName: "text-right",
      cellClassName: "text-right",
      cell: (item) => (
        <div className="flex justify-end gap-1">
          <FormDialog
            mode="edit"
            resourceLabel={resourceLabel}
            resourcePath={resourcePath}
            extraFields={extraFields}
            item={item}
            onSaved={load}
          />
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label={`Delete ${item.name}`}>
                  <Trash2 className="size-4" />
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {item.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This can&apos;t be undone. {resourceLabel}s in use by a product can&apos;t be
                  deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-white hover:bg-destructive/90"
                  onClick={() => handleDelete(item)}
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <FormDialog
          mode="create"
          resourceLabel={resourceLabel}
          resourcePath={resourcePath}
          extraFields={extraFields}
          onSaved={load}
        />
      </div>
      <DataTable
        columns={columns}
        rows={sortedItems}
        isLoading={items === null}
        emptyMessage={`No ${resourceLabel.toLowerCase()}s yet.`}
        keyExtractor={(item) => item.id}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={handleSortChange}
      />
    </div>
  );
}

function FormDialog({
  mode,
  resourceLabel,
  resourcePath,
  extraFields,
  item,
  onSaved,
}: {
  mode: "create" | "edit";
  resourceLabel: string;
  resourcePath: string;
  extraFields?: ExtraField[];
  item?: LookupItem;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(item?.name ?? "");
  const [values, setValues] = useState<Record<string, string | boolean>>(() =>
    Object.fromEntries((extraFields ?? []).map((field) => [field.key, extraFieldDefault(field, item)])),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    const body: Record<string, string | boolean> = { name, ...values };

    try {
      const res = await fetch(
        `${API_URL}/${resourcePath}${mode === "edit" ? `/${item?.id}` : ""}`,
        {
          method: mode === "edit" ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        },
      );

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        toast.error(errBody?.message ?? `Could not save this ${resourceLabel.toLowerCase()}.`);
        return;
      }

      toast.success(`${resourceLabel} ${mode === "edit" ? "updated" : "created"}.`);
      setOpen(false);
      if (mode === "create") {
        setName("");
        setValues(Object.fromEntries((extraFields ?? []).map((field) => [field.key, extraFieldDefault(field)])));
      }
      onSaved();
    } catch {
      toast.error("Could not reach the server.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const formId = `lookup-form-${resourcePath}-${mode}`;

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      trigger={
        mode === "create" ? (
          <Button>
            <Plus className="size-4" />
            New {resourceLabel.toLowerCase()}
          </Button>
        ) : (
          <Button variant="ghost" size="icon-sm" aria-label={`Edit ${item?.name}`}>
            <Pencil className="size-4" />
          </Button>
        )
      }
      title={mode === "edit" ? `Edit ${resourceLabel.toLowerCase()}` : `New ${resourceLabel.toLowerCase()}`}
      description={
        mode === "edit"
          ? `Update this ${resourceLabel.toLowerCase()}'s details.`
          : `Add a new ${resourceLabel.toLowerCase()} to the catalog.`
      }
      footer={
        <Button form={formId} type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save"}
        </Button>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-4 py-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${resourcePath}-name`}>Name</Label>
          <Input
            id={`${resourcePath}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        {(extraFields ?? []).map((field) =>
          field.type === "checkbox" ? (
            <div key={field.key} className="flex items-center justify-between gap-2">
              <Label htmlFor={`${resourcePath}-${field.key}`}>{field.label}</Label>
              <Switch
                id={`${resourcePath}-${field.key}`}
                checked={Boolean(values[field.key])}
                onCheckedChange={(checked) =>
                  setValues((prev) => ({ ...prev, [field.key]: checked }))
                }
              />
            </div>
          ) : (
            <div key={field.key} className="flex flex-col gap-2">
              <Label htmlFor={`${resourcePath}-${field.key}`}>{field.label}</Label>
              <Input
                id={`${resourcePath}-${field.key}`}
                value={(values[field.key] as string) ?? ""}
                placeholder={field.placeholder}
                onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
              />
            </div>
          ),
        )}
      </form>
    </Modal>
  );
}
