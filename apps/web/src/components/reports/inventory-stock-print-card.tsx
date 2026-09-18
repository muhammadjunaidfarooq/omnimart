import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/money";
import type { Product, StockStatus } from "@/lib/catalog";
import type { BusinessSettings } from "@/lib/settings";
import { STOCK_STATUS_LABELS } from "./inventory-stock-report";

interface Props {
  products: Product[];
  stockStatus: StockStatus;
  settings: BusinessSettings;
}

export function InventoryStockPrintCard({ products, stockStatus, settings }: Props) {
  const money = (cents: number) => formatMoney(cents, settings.currencySymbol);
  const totalStockValue = products.reduce((sum, p) => sum + (p.stockValue ?? 0), 0);

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-6 print:border-0 print:shadow-none">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-heading text-xl font-semibold">{settings.storeName}</p>
          <p className="text-sm text-muted-foreground">
            Inventory Report — {STOCK_STATUS_LABELS[stockStatus]}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">Generated {new Date().toLocaleString()}</p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Current Stock</TableHead>
            <TableHead className="text-right">Min Level</TableHead>
            <TableHead className="text-right">Stock Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id}>
              <TableCell>{product.name}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{product.sku}</TableCell>
              <TableCell className="text-muted-foreground">{product.category.name}</TableCell>
              <TableCell className="text-right">
                {product.currentStock} {product.unit.abbreviation}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {product.minimumStockLevel}
              </TableCell>
              <TableCell className="text-right font-medium">{money(product.stockValue ?? 0)}</TableCell>
            </TableRow>
          ))}
          {products.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                No products for this filter.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {products.length > 0 && (
        <div className="flex justify-end border-t pt-2 text-sm font-semibold">
          <span>Total stock value: {money(totalStockValue)}</span>
        </div>
      )}
    </div>
  );
}
