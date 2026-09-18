import Image from "next/image";
import { Badge } from "@/components/ui/badge";
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
import { paymentMethodLabel, type Sale } from "@/lib/sales";
import { businessSettingsLogoSrc, type BusinessSettings } from "@/lib/settings";

interface Props {
  sale: Sale;
  settings: BusinessSettings;
  /** Rendered next to the payment info, e.g. a refund action for admins. */
  action?: React.ReactNode;
}

export function InvoiceCard({ sale, settings, action }: Props) {
  const completedAt = sale.completedAt ? new Date(sale.completedAt) : null;
  const refunds = sale.refunds ?? [];
  const money = (cents: number) => formatMoney(cents, settings.currencySymbol);
  const logoSrc = settings.showLogoOnInvoice ? businessSettingsLogoSrc(settings) : null;

  return (
    <Card className="p-6 print:ring-0 print:shadow-none">
      <CardHeader className="flex flex-row items-start justify-between px-0">
        <div className="flex items-start gap-3">
          {logoSrc && (
            <Image
              src={logoSrc}
              alt={`${settings.storeName} logo`}
              width={40}
              height={40}
              className="size-10 rounded object-contain"
              unoptimized
            />
          )}
          <div>
            <p className="font-heading text-lg font-semibold">{settings.storeName}</p>
            <p className="text-sm text-muted-foreground">Sales Invoice</p>
            {settings.address && <p className="text-xs text-muted-foreground">{settings.address}</p>}
            {(settings.phone || settings.email) && (
              <p className="text-xs text-muted-foreground">
                {[settings.phone, settings.email].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono text-sm font-medium">{sale.invoiceNumber}</p>
          {completedAt && (
            <p className="text-sm text-muted-foreground">
              {completedAt.toLocaleDateString()} {completedAt.toLocaleTimeString()}
            </p>
          )}
          <p className="text-sm text-muted-foreground">Cashier: {sale.cashier.name}</p>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Discount</TableHead>
              <TableHead className="text-right">{settings.taxLabel}</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sale.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <p className="font-medium">{item.productName}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {item.sku}
                    {!!item.refundedQuantity && (
                      <span className="ml-2 text-destructive">
                        {item.refundedQuantity} refunded
                      </span>
                    )}
                  </p>
                </TableCell>
                <TableCell className="text-right">{item.quantity}</TableCell>
                <TableCell className="text-right">{money(item.unitPrice)}</TableCell>
                <TableCell className="text-right">
                  {item.lineDiscount > 0 ? `−${money(item.lineDiscount)}` : "—"}
                </TableCell>
                <TableCell className="text-right">{money(item.lineTax)}</TableCell>
                <TableCell className="text-right font-medium">{money(item.lineTotal)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex flex-col gap-1 self-end text-sm sm:w-64">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{money(sale.subtotal)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Discount</span>
            <span>−{money(sale.discountTotal)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>{settings.taxLabel}</span>
            <span>{money(sale.taxTotal)}</span>
          </div>
          <div className="flex justify-between border-t pt-1 text-base font-semibold">
            <span>Total</span>
            <span>{money(sale.totalAmount)}</span>
          </div>
          {!!sale.refundedAmount && (
            <div className="flex justify-between text-destructive">
              <span>Refunded</span>
              <span>−{money(sale.refundedAmount)}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{paymentMethodLabel(sale.paymentMethod)}</Badge>
            {sale.paymentMethod === "TRANSFER" && sale.transferReference && (
              <span className="text-muted-foreground">Ref: {sale.transferReference}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {sale.paymentMethod === "CASH" && (
              <div className="text-right text-muted-foreground">
                <p>Tendered: {money(sale.cashTendered ?? 0)}</p>
                {/* changeDue is forced to 0 when the change was credited to the
                    customer instead of handed back — borrowerId being set on
                    an otherwise-fully-paid CASH sale is what distinguishes it. */}
                {sale.borrowerId && (sale.changeDue ?? 0) === 0 && (sale.cashTendered ?? 0) > sale.totalAmount ? (
                  <p>Credited to customer: {money((sale.cashTendered ?? 0) - sale.totalAmount)}</p>
                ) : (
                  <p>Change: {money(sale.changeDue ?? 0)}</p>
                )}
              </div>
            )}
            {(sale.paymentMethod === "CREDIT" || sale.paymentMethod === "SPLIT") && (
              <div className="text-right text-muted-foreground">
                <p>Paid: {money(sale.amountPaid)}</p>
                <p>Due: {money(sale.totalAmount - sale.amountPaid)}</p>
              </div>
            )}
            {action}
          </div>
        </div>

        {refunds.length > 0 && (
          <div className="flex flex-col gap-2 print:hidden">
            <p className="text-sm font-medium">Refund history</p>
            {refunds.map((refund) => (
              <div key={refund.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">−{money(refund.totalAmount)}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(refund.createdAt).toLocaleString()} · {refund.refundedBy.name}
                  </span>
                </div>
                {refund.reason && <p className="text-muted-foreground">{refund.reason}</p>}
                <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                  {refund.items.map((item) => {
                    const saleItem = sale.items.find((i) => i.id === item.saleItemId);
                    return (
                      <li key={item.id}>
                        {item.quantity} × {saleItem?.productName ?? item.productId}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}

        {settings.invoiceFooterNote && (
          <p className="text-center text-sm text-muted-foreground">{settings.invoiceFooterNote}</p>
        )}
      </CardContent>
    </Card>
  );
}
