"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  API_URL,
  productImageSrc,
  type Brand,
  type Category,
  type DiscountType,
  type Product,
  type Unit,
} from "@/lib/catalog";
import { bpsToPercentInput, centsToInput, inputToCents, percentInputToBps } from "@/lib/money";

const NO_BRAND = "none";
const NO_DISCOUNT = "none";

export function ProductForm({ product }: { product?: Product }) {
  const router = useRouter();
  const isEdit = Boolean(product);

  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [brandId, setBrandId] = useState(product?.brandId ?? NO_BRAND);
  const [unitId, setUnitId] = useState(product?.unitId ?? "");
  const [costPrice, setCostPrice] = useState(product ? centsToInput(product.costPrice) : "");
  const [sellingPrice, setSellingPrice] = useState(product ? centsToInput(product.sellingPrice) : "");
  const [taxRate, setTaxRate] = useState(product ? bpsToPercentInput(product.taxRateBps) : "0");
  const [discountType, setDiscountType] = useState<string>(product?.discountType ?? NO_DISCOUNT);
  const [discountValue, setDiscountValue] = useState(
    product?.discountValue != null
      ? product.discountType === "PERCENTAGE"
        ? bpsToPercentInput(product.discountValue)
        : centsToInput(product.discountValue)
      : "",
  );
  const [minimumStockLevel, setMinimumStockLevel] = useState(
    String(product?.minimumStockLevel ?? 0),
  );
  const [initialStock, setInitialStock] = useState("0");
  const [initialStockExpiryDate, setInitialStockExpiryDate] = useState("");
  const [isActive, setIsActive] = useState(product?.isActive ?? true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    productImageSrc(product?.imageUrl ?? null),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedUnit = units.find((u) => u.id === unitId);
  const isFractional = selectedUnit?.allowsFractionalQuantity ?? false;

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/categories`, { credentials: "include" }).then((r) => r.json()),
      fetch(`${API_URL}/brands`, { credentials: "include" }).then((r) => r.json()),
      fetch(`${API_URL}/units`, { credentials: "include" }).then((r) => r.json()),
      fetch(`${API_URL}/settings`, { credentials: "include" }).then((r) => r.json()),
    ]).then(([categoriesData, brandsData, unitsData, settingsData]) => {
      setCategories(categoriesData);
      setBrands(brandsData);
      setUnits(unitsData);
      if (!isEdit) {
        setTaxRate(bpsToPercentInput(settingsData.defaultTaxRateBps));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setImageFile(file);
    if (file) {
      setImagePreview(URL.createObjectURL(file));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    const body: Record<string, unknown> = {
      name,
      description: description || undefined,
      categoryId,
      brandId: brandId === NO_BRAND ? undefined : brandId,
      unitId,
      costPrice: inputToCents(costPrice),
      sellingPrice: inputToCents(sellingPrice),
      taxRateBps: percentInputToBps(taxRate),
      minimumStockLevel:
        (isFractional ? Number.parseFloat(minimumStockLevel) : Number.parseInt(minimumStockLevel, 10)) || 0,
      isActive,
    };

    if (discountType !== NO_DISCOUNT) {
      body.discountType = discountType;
      body.discountValue =
        discountType === "PERCENTAGE" ? percentInputToBps(discountValue) : inputToCents(discountValue);
    } else {
      body.discountType = null;
      body.discountValue = null;
    }

    if (!isEdit) {
      body.initialStock =
        (isFractional ? Number.parseFloat(initialStock) : Number.parseInt(initialStock, 10)) || 0;
      if ((body.initialStock as number) > 0 && initialStockExpiryDate) {
        body.initialStockExpiryDate = initialStockExpiryDate;
      }
    }

    try {
      const res = await fetch(`${API_URL}/products${isEdit ? `/${product!.id}` : ""}`, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        const message = Array.isArray(errBody?.message) ? errBody.message.join(", ") : errBody?.message;
        toast.error(message ?? "Could not save product.");
        return;
      }

      const saved = await res.json();

      if (imageFile) {
        const formData = new FormData();
        formData.append("image", imageFile);
        const imageRes = await fetch(`${API_URL}/products/${saved.id}/image`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        if (!imageRes.ok) {
          toast.error("Product saved, but the image failed to upload.");
        }
      }

      toast.success(isEdit ? "Product updated." : "Product created.");
      router.push("/admin/catalog");
      router.refresh();
    } catch {
      toast.error("Could not reach the server.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Product details</CardTitle>
            <CardDescription>Basic information shown in the catalog and at checkout.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="category">Category</Label>
                <Combobox
                  id="category"
                  className="w-full"
                  value={categoryId}
                  onValueChange={setCategoryId}
                  placeholder="Select category"
                  searchPlaceholder="Search categories…"
                  options={categories.map((c) => ({ value: c.id, label: c.name }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="brand">Brand</Label>
                <Combobox
                  id="brand"
                  className="w-full"
                  value={brandId}
                  onValueChange={(v) => setBrandId(v || NO_BRAND)}
                  placeholder="No brand"
                  searchPlaceholder="Search brands…"
                  options={[
                    { value: NO_BRAND, label: "No brand" },
                    ...brands.map((b) => ({ value: b.id, label: b.name })),
                  ]}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="unit">Unit</Label>
                <Combobox
                  id="unit"
                  className="w-full"
                  value={unitId}
                  onValueChange={setUnitId}
                  placeholder="Select unit"
                  searchPlaceholder="Search units…"
                  options={units.map((u) => ({ value: u.id, label: `${u.name} (${u.abbreviation})` }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Image</CardTitle>
            <CardDescription>JPEG, PNG, or WebP, up to 5MB.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <div className="flex size-32 items-center justify-center overflow-hidden rounded-lg border bg-muted">
              {imagePreview ? (
                <Image
                  src={imagePreview}
                  alt="Product preview"
                  width={128}
                  height={128}
                  className="size-32 object-cover"
                  unoptimized
                />
              ) : (
                <span className="text-xs text-muted-foreground">No image</span>
              )}
            </div>
            <Input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pricing & tax</CardTitle>
            <CardDescription>All prices are in your store&apos;s base currency unit.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="costPrice">Cost price</Label>
                <Input
                  id="costPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="sellingPrice">Selling price</Label>
                <Input
                  id="sellingPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="taxRate">Tax rate (%)</Label>
              <Input
                id="taxRate"
                type="number"
                step="0.01"
                min="0"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="discountType">Discount</Label>
                <Select value={discountType} onValueChange={(v) => v && setDiscountType(v)}>
                  <SelectTrigger id="discountType" className="w-full">
                    <SelectValue>
                      {(value: string) =>
                        value === "PERCENTAGE"
                          ? "Percentage"
                          : value === "FIXED"
                            ? "Fixed amount"
                            : "No discount"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_DISCOUNT}>No discount</SelectItem>
                    <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                    <SelectItem value="FIXED">Fixed amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {discountType !== NO_DISCOUNT && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="discountValue">
                    {discountType === "PERCENTAGE" ? "Discount (%)" : "Discount amount"}
                  </Label>
                  <Input
                    id="discountValue"
                    type="number"
                    step="0.01"
                    min="0"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    required
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stock</CardTitle>
            <CardDescription>
              {isEdit
                ? "Stock is only changed via inventory adjustments, not from this form."
                : "Opening stock is recorded as an initial stock-in movement."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="minimumStockLevel">Minimum stock level</Label>
              <Input
                id="minimumStockLevel"
                type="number"
                min="0"
                step={isFractional ? "0.001" : "1"}
                value={minimumStockLevel}
                onChange={(e) => setMinimumStockLevel(e.target.value)}
              />
            </div>
            {isEdit ? (
              <div className="flex flex-col gap-2">
                <Label>Current stock</Label>
                <Input value={`${product!.currentStock} ${product!.unit.abbreviation}`} disabled />
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Label htmlFor="initialStock">Initial stock</Label>
                <Input
                  id="initialStock"
                  type="number"
                  min="0"
                  step={isFractional ? "0.001" : "1"}
                  value={initialStock}
                  onChange={(e) => setInitialStock(e.target.value)}
                />
              </div>
            )}
            {!isEdit && Number(initialStock) > 0 && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="initialStockExpiryDate">Expiry date (optional)</Label>
                <Input
                  id="initialStockExpiryDate"
                  type="date"
                  value={initialStockExpiryDate}
                  onChange={(e) => setInitialStockExpiryDate(e.target.value)}
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} id="isActive" />
              <Label htmlFor="isActive">Active</Label>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardFooter className="justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/admin/catalog")}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : isEdit ? "Save changes" : "Create product"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
