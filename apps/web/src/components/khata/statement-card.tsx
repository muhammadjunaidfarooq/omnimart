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
import type { BorrowerStatement, LedgerEntryType } from "@/lib/khata";
import { businessSettingsLogoSrc, type BusinessSettings } from "@/lib/settings";

const TYPE_LABELS: Record<LedgerEntryType, string> = {
  PURCHASE: "Purchase",
  PAYMENT: "Payment",
  REFUND: "Refund",
};

const TYPE_BADGE_VARIANTS: Record<LedgerEntryType, "outline" | "secondary" | "destructive"> = {
  PURCHASE: "outline",
  PAYMENT: "secondary",
  REFUND: "destructive",
};

function formatRange(from?: string, to?: string) {
  if (!from && !to) return "Complete history";
  const fromLabel = from ? new Date(from).toLocaleDateString() : "the beginning";
  const toLabel = to ? new Date(to).toLocaleDateString() : "today";
  return `${fromLabel} – ${toLabel}`;
}

interface Props {
  statement: BorrowerStatement;
  settings: BusinessSettings;
  from?: string;
  to?: string;
}

export function StatementCard({ statement, settings, from, to }: Props) {
  const money = (cents: number) => formatMoney(cents, settings.currencySymbol);
  const logoSrc = settings.showLogoOnInvoice ? businessSettingsLogoSrc(settings) : null;
  const billed = statement.ledger.reduce((sum, entry) => sum + entry.debit, 0);
  const settled = statement.ledger.reduce((sum, entry) => sum + entry.credit, 0);

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
            <p className="text-sm text-muted-foreground">Customer Statement</p>
            {settings.address && <p className="text-xs text-muted-foreground">{settings.address}</p>}
            {(settings.phone || settings.email) && (
              <p className="text-xs text-muted-foreground">
                {[settings.phone, settings.email].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="font-medium">{statement.name}</p>
          {statement.phone && <p className="text-sm text-muted-foreground">{statement.phone}</p>}
          <p className="text-sm text-muted-foreground">{formatRange(from, to)}</p>
          <p className="text-xs text-muted-foreground">Generated {new Date().toLocaleString()}</p>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-0">
        <div className="rounded-lg border bg-muted/40 p-3">
          <p className="text-sm text-muted-foreground">Total outstanding balance (as of today)</p>
          <p className="text-xl font-semibold">{money(statement.totalDue)}</p>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                Opening balance
              </TableCell>
              <TableCell className="text-right font-medium">{money(statement.openingBalance)}</TableCell>
            </TableRow>
            {statement.ledger.map((entry, i) => (
              <TableRow key={`${entry.type}-${entry.saleId}-${i}`}>
                <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                <TableCell>{entry.description}</TableCell>
                <TableCell>
                  <Badge variant={TYPE_BADGE_VARIANTS[entry.type]}>{TYPE_LABELS[entry.type]}</Badge>
                </TableCell>
                <TableCell className="text-right">{entry.debit > 0 ? money(entry.debit) : "—"}</TableCell>
                <TableCell className="text-right">{entry.credit > 0 ? money(entry.credit) : "—"}</TableCell>
                <TableCell className="text-right font-medium">{money(entry.balance)}</TableCell>
              </TableRow>
            ))}
            {statement.ledger.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No transactions in this period.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <div className="flex flex-col gap-1 self-end text-sm sm:w-64">
          <div className="flex justify-between text-muted-foreground">
            <span>Opening balance</span>
            <span>{money(statement.openingBalance)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Billed this period</span>
            <span>{money(billed)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Paid / adjusted this period</span>
            <span>−{money(settled)}</span>
          </div>
          <div className="flex justify-between border-t pt-1 text-base font-semibold">
            <span>Closing balance</span>
            <span>{money(statement.closingBalance)}</span>
          </div>
        </div>

        {settings.invoiceFooterNote && (
          <p className="text-center text-sm text-muted-foreground">{settings.invoiceFooterNote}</p>
        )}
      </CardContent>
    </Card>
  );
}
