"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search } from "lucide-react";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { API_URL, productImageSrc, type Category, type Product } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";
import { useCart } from "./cart-context";

const ALL_CATEGORIES = "all";
const PAGE_SIZE = 60;

async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(`${API_URL}/categories`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch categories");
  return res.json();
}

async function fetchProducts(search: string, categoryId: string): Promise<Product[]> {
  const params = new URLSearchParams({ pageSize: String(PAGE_SIZE), isActive: "true" });
  if (search) params.set("search", search);
  if (categoryId !== ALL_CATEGORIES) params.set("categoryId", categoryId);
  const res = await fetch(`${API_URL}/products?${params}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch products");
  const data = await res.json();
  return data.items;
}

export function ProductGrid() {
  const cart = useCart();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryId, setCategoryId] = useState(ALL_CATEGORIES);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const { data: categories } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const { data: products, isLoading } = useQuery({
    queryKey: ["pos-products", debouncedSearch, categoryId],
    queryFn: () => fetchProducts(debouncedSearch, categoryId),
    placeholderData: (prev) => prev,
  });

  function handleAddProduct(product: Product) {
    if (product.currentStock <= 0) {
      toast.error(`${product.name} is out of stock.`);
      return;
    }
    const inCart = cart.lines
      .filter((l) => l.product.id === product.id)
      .reduce((sum, l) => sum + l.quantity, 0);
    if (inCart + 1 > product.currentStock) {
      toast.error(`Only ${product.currentStock} ${product.unit.abbreviation} of ${product.name} available.`);
      return;
    }
    cart.addItem(product);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            id="pos-search"
            placeholder="Search by name or SKU... (F1)"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setCategoryId(ALL_CATEGORIES)}>
          <Badge variant={categoryId === ALL_CATEGORIES ? "default" : "outline"}>All</Badge>
        </button>
        {categories?.map((c) => (
          <button key={c.id} type="button" onClick={() => setCategoryId(c.id)}>
            <Badge variant={categoryId === c.id ? "default" : "outline"}>{c.name}</Badge>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 pb-2 sm:grid-cols-3 lg:grid-cols-4">
        {isLoading && !products
          ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)
          : products?.map((product) => {
              const outOfStock = product.currentStock <= 0;
              const imageSrc = productImageSrc(product.imageUrl);
              return (
                <Card
                  key={product.id}
                  size="sm"
                  className={`cursor-pointer transition-opacity hover:ring-2 hover:ring-primary/50 ${
                    outOfStock ? "cursor-not-allowed opacity-50" : ""
                  }`}
                  onClick={() => handleAddProduct(product)}
                >
                  <div className="flex h-20 items-center justify-center bg-muted">
                    {imageSrc ? (
                      <Image
                        src={imageSrc}
                        alt={product.name}
                        width={80}
                        height={80}
                        className="h-20 w-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">No image</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5 px-3">
                    <p className="line-clamp-2 text-sm font-medium">{product.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{product.sku}</p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-sm font-semibold">{formatMoney(product.activeSellingPrice)}</span>
                      {outOfStock ? (
                        <Badge variant="destructive">Out</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {product.currentStock} {product.unit.abbreviation}
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
        {!isLoading && products?.length === 0 && (
          <p className="col-span-full py-12 text-center text-sm text-muted-foreground">
            No products found.
          </p>
        )}
      </div>
    </div>
  );
}
