import Image from "next/image";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/money";
import type { Product } from "@/lib/catalog";
import { businessSettingsLogoSrc, type BusinessSettings } from "@/lib/settings";

interface Props {
  products: Product[];
  settings: BusinessSettings;
}

/** Groups already-sorted (category, then name) products into ordered category buckets. */
function groupByCategory(products: Product[]): [string, Product[]][] {
  const groups = new Map<string, Product[]>();
  for (const product of products) {
    const bucket = groups.get(product.category.name) ?? [];
    bucket.push(product);
    groups.set(product.category.name, bucket);
  }
  return Array.from(groups.entries());
}

export function PriceListCard({ products, settings }: Props) {
  const money = (cents: number) => formatMoney(cents, settings.currencySymbol);
  const logoSrc = settings.showLogoOnInvoice ? businessSettingsLogoSrc(settings) : null;
  const categories = groupByCategory(products);

  return (
    <Card className="p-6 print:ring-0 print:shadow-none">
      <CardHeader className="flex flex-row items-start justify-between px-0">
        <div className="flex items-start gap-3">
          {logoSrc && (
            <Image
              src={logoSrc}
              alt={`${settings.storeName} logo`}
              width={48}
              height={48}
              className="size-12 rounded object-contain"
              unoptimized
            />
          )}
          <div>
            <p className="font-heading text-xl font-semibold">{settings.storeName}</p>
            <p className="text-sm text-muted-foreground">Price List</p>
            {settings.address && <p className="text-xs text-muted-foreground">{settings.address}</p>}
            {(settings.phone || settings.email) && (
              <p className="text-xs text-muted-foreground">
                {[settings.phone, settings.email].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Generated {new Date().toLocaleString()}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 px-0">
        {categories.map(([categoryName, items]) => (
          <div key={categoryName} className="flex flex-col gap-2 break-inside-avoid">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {categoryName}
            </h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>{product.name}</TableCell>
                    <TableCell className="text-right font-medium">
                      {money(product.activeSellingPrice)}
                      <span className="ml-1 text-xs text-muted-foreground">
                        / {product.unit.abbreviation}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))}

        {products.length === 0 && (
          <p className="text-center text-muted-foreground">No active products to list.</p>
        )}

        {settings.invoiceFooterNote && (
          <p className="text-center text-sm text-muted-foreground">{settings.invoiceFooterNote}</p>
        )}
      </CardContent>
    </Card>
  );
}
