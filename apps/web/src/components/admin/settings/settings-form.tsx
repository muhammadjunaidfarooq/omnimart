"use client";

import { useState, type FormEvent } from "react";
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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { bpsToPercentInput, centsToInput, inputToCents, percentInputToBps } from "@/lib/money";
import {
  businessSettingsLogoSrc,
  updateSettings,
  uploadLogo,
  type BusinessSettings,
} from "@/lib/settings";

const NO_DISCOUNT = "none";

export function SettingsForm({ settings }: { settings: BusinessSettings }) {
  const router = useRouter();

  const [storeName, setStoreName] = useState(settings.storeName);
  const [address, setAddress] = useState(settings.address ?? "");
  const [phone, setPhone] = useState(settings.phone ?? "");
  const [email, setEmail] = useState(settings.email ?? "");
  const [currencyCode, setCurrencyCode] = useState(settings.currencyCode);
  const [currencySymbol, setCurrencySymbol] = useState(settings.currencySymbol);
  const [defaultTaxRate, setDefaultTaxRate] = useState(bpsToPercentInput(settings.defaultTaxRateBps));
  const [taxLabel, setTaxLabel] = useState(settings.taxLabel);
  const [expiryWarningDays, setExpiryWarningDays] = useState(String(settings.expiryWarningDays));
  const [invoiceFooterNote, setInvoiceFooterNote] = useState(settings.invoiceFooterNote ?? "");
  const [showLogoOnInvoice, setShowLogoOnInvoice] = useState(settings.showLogoOnInvoice);
  const [globalDiscountEnabled, setGlobalDiscountEnabled] = useState(settings.globalDiscountEnabled);
  const [globalDiscountType, setGlobalDiscountType] = useState<string>(settings.globalDiscountType ?? NO_DISCOUNT);
  const [globalDiscountValue, setGlobalDiscountValue] = useState(
    settings.globalDiscountValue != null
      ? settings.globalDiscountType === "PERCENTAGE"
        ? bpsToPercentInput(settings.globalDiscountValue)
        : centsToInput(settings.globalDiscountValue)
      : "",
  );
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(businessSettingsLogoSrc(settings));
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setLogoFile(file);
    if (file) {
      setLogoPreview(URL.createObjectURL(file));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await updateSettings({
        storeName,
        address: address || undefined,
        phone: phone || undefined,
        email: email || undefined,
        currencyCode,
        currencySymbol,
        defaultTaxRateBps: percentInputToBps(defaultTaxRate),
        taxLabel,
        expiryWarningDays: parseInt(expiryWarningDays, 10) || 0,
        invoiceFooterNote: invoiceFooterNote || undefined,
        showLogoOnInvoice,
        globalDiscountEnabled,
        globalDiscountType: globalDiscountType === NO_DISCOUNT ? null : (globalDiscountType as "PERCENTAGE" | "FIXED"),
        globalDiscountValue:
          globalDiscountType === NO_DISCOUNT
            ? null
            : globalDiscountType === "PERCENTAGE"
              ? percentInputToBps(globalDiscountValue)
              : inputToCents(globalDiscountValue),
      });

      if (logoFile) {
        const updated = await uploadLogo(logoFile);
        setLogoPreview(businessSettingsLogoSrc(updated));
        setLogoFile(null);
      }

      toast.success("Settings saved.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save settings.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Store info</CardTitle>
            <CardDescription>Shown on invoices and used as your store&apos;s identity across the app.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="storeName">Store name</Label>
              <Input id="storeName" value={storeName} onChange={(e) => setStoreName(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="address">Address</Label>
              <Textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Logo</CardTitle>
            <CardDescription>JPEG, PNG, or WebP, up to 5MB.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <div className="flex size-32 items-center justify-center overflow-hidden rounded-lg border bg-muted">
              {logoPreview ? (
                <Image
                  src={logoPreview}
                  alt="Store logo preview"
                  width={128}
                  height={128}
                  className="size-32 object-contain"
                  unoptimized
                />
              ) : (
                <span className="text-xs text-muted-foreground">No logo</span>
              )}
            </div>
            <Input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleLogoChange} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Currency</CardTitle>
            <CardDescription>Applied to invoice totals.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="currencyCode">Currency code</Label>
              <Input
                id="currencyCode"
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())}
                placeholder="USD"
                maxLength={3}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="currencySymbol">Symbol</Label>
              <Input
                id="currencySymbol"
                value={currencySymbol}
                onChange={(e) => setCurrencySymbol(e.target.value)}
                placeholder="$"
                required
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tax & invoice</CardTitle>
            <CardDescription>
              The default tax rate prefills new products — it doesn&apos;t change existing ones.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="defaultTaxRate">Default tax rate (%)</Label>
                <Input
                  id="defaultTaxRate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={defaultTaxRate}
                  onChange={(e) => setDefaultTaxRate(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="taxLabel">Tax label</Label>
                <Input
                  id="taxLabel"
                  value={taxLabel}
                  onChange={(e) => setTaxLabel(e.target.value)}
                  placeholder="Tax, VAT, GST…"
                  required
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="expiryWarningDays">Expiry warning window (days)</Label>
              <Input
                id="expiryWarningDays"
                type="number"
                step="1"
                min="0"
                className="sm:max-w-40"
                value={expiryWarningDays}
                onChange={(e) => setExpiryWarningDays(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                A stock batch expiring within this many days shows as &quot;Expiring Soon&quot; on the Expiry page.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="invoiceFooterNote">Invoice footer note</Label>
              <Textarea
                id="invoiceFooterNote"
                value={invoiceFooterNote}
                onChange={(e) => setInvoiceFooterNote(e.target.value)}
                placeholder="e.g. Thank you for shopping with us!"
                rows={2}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={showLogoOnInvoice} onCheckedChange={setShowLogoOnInvoice} id="showLogoOnInvoice" />
              <Label htmlFor="showLogoOnInvoice">Show logo on invoice</Label>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Global discount</CardTitle>
          <CardDescription>
            When enabled, this discount applies to every product at checkout instead of each
            product&apos;s own discount.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={globalDiscountEnabled}
              onCheckedChange={setGlobalDiscountEnabled}
              id="globalDiscountEnabled"
            />
            <Label htmlFor="globalDiscountEnabled">Apply global discount to all products</Label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="globalDiscountType">Discount</Label>
              <Select value={globalDiscountType} onValueChange={(v) => v && setGlobalDiscountType(v)}>
                <SelectTrigger id="globalDiscountType" className="w-full">
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
            {globalDiscountType !== NO_DISCOUNT && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="globalDiscountValue">
                  {globalDiscountType === "PERCENTAGE" ? "Discount (%)" : "Discount amount"}
                </Label>
                <Input
                  id="globalDiscountValue"
                  type="number"
                  step="0.01"
                  min="0"
                  value={globalDiscountValue}
                  onChange={(e) => setGlobalDiscountValue(e.target.value)}
                  required
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardFooter className="justify-end gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save settings"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
