"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, Pencil, Plus, Copy, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { API_URL, productImageSrc, type Brand, type Category, type Product } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";
import { useCurrencySymbol } from "@/lib/settings";
import { useSortState } from "@/lib/use-sort";
import { ProductsBulkActions } from "./products-bulk-actions";

const PAGE_SIZE = 20;
const ALL_CATEGORIES = "all";

type ProductStockFilter = "all" | "out";

export function ProductsTable() {
  const router = useRouter();
  const currencySymbol = useCurrencySymbol();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string>(ALL_CATEGORIES);
  const [stockStatus, setStockStatus] = useState<ProductStockFilter>("all");
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { sortBy, sortOrder, handleSortChange } = useSortState("name");

  useEffect(() => {
    fetch(`${API_URL}/categories`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then(setCategories);
    fetch(`${API_URL}/brands`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then(setBrands);
  }, []);

  function loadProducts() {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
      sortBy,
      sortOrder,
    });
    if (search) params.set("search", search);
    if (categoryId !== ALL_CATEGORIES) params.set("categoryId", categoryId);
    if (stockStatus !== "all") params.set("stockStatus", stockStatus);

    fetch(`${API_URL}/products?${params.toString()}`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        setProducts(data.items);
        setTotal(data.total);
        setSelectedIds(new Set());
      })
      .catch(() => toast.error("Could not load products."));
  }

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, categoryId, stockStatus, sortBy, sortOrder]);

  function handleSort(key: string) {
    setPage(1);
    handleSortChange(key);
  }

  async function handleDelete(product: Product) {
    const res = await fetch(`${API_URL}/products/${product.id}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.message ?? "Could not delete this product.");
      return;
    }

    toast.success(`${product.name} deleted.`);
    setProducts((prev) => prev?.filter((p) => p.id !== product.id) ?? null);
    setTotal((prev) => Math.max(0, prev - 1));
  }

  async function handleDuplicate(product: Product) {
    const res = await fetch(`${API_URL}/products/${product.id}/duplicate`, {
      method: "POST",
      credentials: "include",
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.message ?? "Could not duplicate this product.");
      return;
    }

    const copy: Product = await res.json();
    toast.success(`Duplicated as ${copy.sku} — update its details below.`);
    router.push(`/admin/catalog/${copy.id}/edit`);
  }

  async function handleToggleActive(product: Product) {
    const res = await fetch(`${API_URL}/products/${product.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ isActive: !product.isActive }),
    });

    if (!res.ok) {
      toast.error("Could not update product status.");
      return;
    }

    setProducts((prev) =>
      prev?.map((p) => (p.id === product.id ? { ...p, isActive: !p.isActive } : p)) ?? null,
    );
    toast.success(product.isActive ? "Product deactivated." : "Product activated.");
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const columns: DataTableColumn<Product>[] = [
    {
      header: (
        <Checkbox
          checked={(products?.length ?? 0) > 0 && (products ?? []).every((p) => selectedIds.has(p.id))}
          onChange={(e) => {
            setSelectedIds(e.target.checked ? new Set((products ?? []).map((p) => p.id)) : new Set());
          }}
          aria-label="Select all on this page"
        />
      ),
      headerClassName: "w-10",
      cell: (product) => (
        <Checkbox
          checked={selectedIds.has(product.id)}
          onChange={(e) => {
            setSelectedIds((prev) => {
              const next = new Set(prev);
              if (e.target.checked) next.add(product.id);
              else next.delete(product.id);
              return next;
            });
          }}
          aria-label={`Select ${product.name}`}
        />
      ),
    },
    {
      header: "",
      headerClassName: "w-14",
      cell: (product) => {
        const imageSrc = productImageSrc(product.imageUrl);
        return (
          <div className="flex size-10 items-center justify-center overflow-hidden rounded-md bg-muted">
            {imageSrc ? (
              <Image
                src={imageSrc}
                alt={product.name}
                width={40}
                height={40}
                className="size-10 object-cover"
                unoptimized
              />
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </div>
        );
      },
    },
    {
      header: "SKU",
      sortKey: "sku",
      cell: (product) => (
        <span className="font-mono text-xs text-muted-foreground">{product.sku}</span>
      ),
    },
    {
      header: "Name",
      sortKey: "name",
      cell: (product) => <span className="font-medium">{product.name}</span>,
    },
    {
      header: "Category",
      sortKey: "category",
      cell: (product) => (
        <span className="text-muted-foreground">{product.category.name}</span>
      ),
    },
    {
      header: "Price",
      sortKey: "sellingPrice",
      headerClassName: "text-right",
      cellClassName: "text-right",
      cell: (product) => formatMoney(product.sellingPrice, currencySymbol),
    },
    {
      header: "Stock",
      sortKey: "currentStock",
      headerClassName: "text-right",
      cellClassName: "text-right",
      cell: (product) => {
        const isLowStock = product.currentStock <= product.minimumStockLevel;
        return (
          <>
            <span className={isLowStock ? "font-medium text-destructive" : undefined}>
              {product.currentStock}
            </span>
            <span className="text-muted-foreground"> {product.unit.abbreviation}</span>
          </>
        );
      },
    },
    {
      header: "Status",
      cell: (product) => (
        <div className="flex items-center gap-2">
          <Switch
            checked={product.isActive}
            onCheckedChange={() => handleToggleActive(product)}
          />
          <Badge variant={product.isActive ? "secondary" : "outline"}>
            {product.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
      ),
    },
    {
      header: "Actions",
      headerClassName: "text-right",
      cellClassName: "text-right",
      cell: (product) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => handleDuplicate(product)}
            aria-label={`Duplicate ${product.name}`}
            title="Duplicate"
          >
            <Copy className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            render={<Link href={`/admin/catalog/${product.id}/edit`} />}
            nativeButton={false}
            aria-label={`Edit ${product.name}`}
            title="Edit"
          >
            <Pencil className="size-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${product.name}`}
                  title="Delete"
                >
                  <Trash2 className="size-4" />
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {product.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This can&apos;t be undone. Products with sales or stock history can&apos;t be
                  deleted — deactivate them instead.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-white hover:bg-destructive/90"
                  onClick={() => handleDelete(product)}
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or SKU..."
              className="pl-8"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
            />
          </div>
          <Combobox
            className="w-full sm:w-48"
            value={categoryId}
            onValueChange={(value) => {
              setPage(1);
              setCategoryId(value || ALL_CATEGORIES);
            }}
            options={[
              { value: ALL_CATEGORIES, label: "All categories" },
              ...categories.map((category) => ({ value: category.id, label: category.name })),
            ]}
            searchPlaceholder="Search categories…"
          />
          <Select
            value={stockStatus}
            onValueChange={(v) => {
              setPage(1);
              setStockStatus(v as ProductStockFilter);
            }}
          >
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue>{(v: string) => (v === "out" ? "Out of Stock" : "All products")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All products</SelectItem>
              <SelectItem value="out">Out of Stock</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            render={<Link href="/admin/catalog/price-list" />}
            nativeButton={false}
          >
            <Download className="size-4" />
            Download Price List
          </Button>
          <Button render={<Link href="/admin/catalog/new" />} nativeButton={false}>
            <Plus className="size-4" />
            New product
          </Button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <ProductsBulkActions
          selectedIds={Array.from(selectedIds)}
          categories={categories}
          brands={brands}
          onDone={loadProducts}
        />
      )}

      <DataTable
        columns={columns}
        rows={products ?? undefined}
        isLoading={products === null}
        emptyMessage="No products found."
        keyExtractor={(p) => p.id}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={handleSort}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} of {totalPages} ({total} products)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
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
