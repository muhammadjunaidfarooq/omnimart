"use client";

import { useRouter } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  backHref: string;
  backLabel: string;
}

export function InvoiceActions({ backHref, backLabel }: Props) {
  const router = useRouter();

  return (
    <div className="flex justify-end gap-2 print:hidden">
      <Button variant="outline" onClick={() => router.push(backHref)}>
        <ArrowLeft className="size-4" />
        {backLabel}
      </Button>
      <Button onClick={() => window.print()}>
        <Printer className="size-4" />
        Print
      </Button>
    </div>
  );
}
