"use client";

import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/** A plain native checkbox styled to match the rest of the UI kit — used for table row/bulk selection. */
export function Checkbox({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn(
        "size-4 rounded border-input accent-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
