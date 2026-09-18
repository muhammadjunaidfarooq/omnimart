import { ProductForm } from "@/components/admin/product-form";

export default function NewProductPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New product</h1>
        <p className="text-muted-foreground">Add a product to the catalog.</p>
      </div>
      <ProductForm />
    </div>
  );
}
