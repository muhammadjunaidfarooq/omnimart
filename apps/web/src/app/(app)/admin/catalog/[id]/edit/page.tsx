import { notFound } from "next/navigation";
import { ProductForm } from "@/components/admin/product-form";
import { getProduct } from "@/lib/api";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit product</h1>
        <p className="text-muted-foreground">{product.name}</p>
      </div>
      <ProductForm product={product} />
    </div>
  );
}
