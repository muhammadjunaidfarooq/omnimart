"use client";

import * as React from "react";
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  id?: string;
  "aria-label"?: string;
}

/**
 * A searchable dropdown — same look and controlled value/onValueChange shape
 * as <Select>, but with a filter input inside the popup for long or
 * data-driven option lists. Reach for plain <Select> instead for a small
 * fixed set of options, where a search box would only add friction.
 */
export function Combobox({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
  className,
  id,
  "aria-label": ariaLabel,
}: ComboboxProps) {
  const selected = options.find((option) => option.value === value) ?? null;

  return (
    <ComboboxPrimitive.Root
      items={options}
      value={selected}
      onValueChange={(item) => onValueChange(item ? item.value : "")}
      isItemEqualToValue={(a, b) => a.value === b.value}
    >
      <ComboboxPrimitive.Trigger
        id={id}
        className={cn(
          "flex h-8 w-fit items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
          className,
        )}
      >
        <ComboboxPrimitive.Value placeholder={placeholder}>
          {(item: ComboboxOption | null) => item?.label ?? placeholder}
        </ComboboxPrimitive.Value>
        <ComboboxPrimitive.Icon
          render={<ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground" />}
        />
      </ComboboxPrimitive.Trigger>
      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner side="bottom" sideOffset={4} align="start" className="isolate z-50">
          <ComboboxPrimitive.Popup
            aria-label={ariaLabel}
            className="relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-56 origin-(--transform-origin) overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          >
            <div className="relative border-b">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <ComboboxPrimitive.Input
                placeholder={searchPlaceholder}
                className="h-9 w-full bg-transparent py-2 pr-2.5 pl-8 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <ComboboxPrimitive.Empty className="px-3 py-6 text-center text-sm text-muted-foreground empty:m-0 empty:p-0">
              {emptyMessage}
            </ComboboxPrimitive.Empty>
            <ComboboxPrimitive.List className="max-h-64 overflow-y-auto p-1 scroll-py-1">
              {(item: ComboboxOption) => (
                <ComboboxPrimitive.Item
                  key={item.value}
                  value={item}
                  className="relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                >
                  <span className="flex-1 truncate">{item.label}</span>
                  <ComboboxPrimitive.ItemIndicator className="absolute right-2 flex size-4 items-center justify-center">
                    <CheckIcon className="size-4" />
                  </ComboboxPrimitive.ItemIndicator>
                </ComboboxPrimitive.Item>
              )}
            </ComboboxPrimitive.List>
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  );
}
