import { useQuery } from "@tanstack/react-query";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface BusinessSettings {
  id: number;
  storeName: string;
  logoUrl: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  currencyCode: string;
  currencySymbol: string;
  defaultTaxRateBps: number;
  taxLabel: string;
  expiryWarningDays: number;
  invoiceFooterNote: string | null;
  showLogoOnInvoice: boolean;
  globalDiscountEnabled: boolean;
  globalDiscountType: "PERCENTAGE" | "FIXED" | null;
  globalDiscountValue: number | null;
  updatedAt: string;
}

export interface UpdateSettingsInput {
  storeName?: string;
  address?: string;
  phone?: string;
  email?: string;
  currencyCode?: string;
  currencySymbol?: string;
  defaultTaxRateBps?: number;
  taxLabel?: string;
  expiryWarningDays?: number;
  invoiceFooterNote?: string;
  showLogoOnInvoice?: boolean;
  globalDiscountEnabled?: boolean;
  globalDiscountType?: "PERCENTAGE" | "FIXED" | null;
  globalDiscountValue?: number | null;
}

export const settingsKeys = {
  all: ["settings"] as const,
};

function logoSrc(logoUrl: string | null): string | null {
  if (!logoUrl) return null;
  return `${API_URL}${logoUrl}`;
}

export function businessSettingsLogoSrc(settings: Pick<BusinessSettings, "logoUrl">): string | null {
  return logoSrc(settings.logoUrl);
}

export async function fetchSettings(): Promise<BusinessSettings> {
  const res = await fetch(`${API_URL}/settings`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch settings");
  return res.json();
}

/** The store's configured currency symbol, for `formatMoney(cents, currencySymbol)` calls in client components. Empty string while settings are still loading. */
export function useCurrencySymbol(): string {
  const { data } = useQuery({ queryKey: settingsKeys.all, queryFn: fetchSettings });
  return data?.currencySymbol ?? "";
}

/** Full business settings, shared with `useCurrencySymbol` via the same query cache. Undefined while still loading. */
export function useBusinessSettings(): BusinessSettings | undefined {
  const { data } = useQuery({ queryKey: settingsKeys.all, queryFn: fetchSettings });
  return data;
}

async function parseErrorMessage(res: Response, fallback: string) {
  const err = await res.json().catch(() => ({}));
  const message = (err as { message?: string | string[] }).message;
  return Array.isArray(message) ? message.join(", ") : message ?? fallback;
}

export async function updateSettings(input: UpdateSettingsInput): Promise<BusinessSettings> {
  const res = await fetch(`${API_URL}/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Could not update settings"));
  return res.json();
}

export async function uploadLogo(file: File): Promise<BusinessSettings> {
  const formData = new FormData();
  formData.append("logo", file);
  const res = await fetch(`${API_URL}/settings/logo`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Could not upload logo"));
  return res.json();
}
