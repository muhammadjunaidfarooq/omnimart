import { Badge } from "@/components/ui/badge";
import type { Product } from "@/lib/catalog";

export function StockStatusBadge({ product }: { product: Product }) {
  if (product.currentStock === 0)
    return <Badge variant="destructive">Out of Stock</Badge>;
  if (product.currentStock <= product.minimumStockLevel)
    return (
      <Badge
        variant="secondary"
        className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
      >
        Low Stock
      </Badge>
    );
  return (
    <Badge
      variant="secondary"
      className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
    >
      In Stock
    </Badge>
  );
}
