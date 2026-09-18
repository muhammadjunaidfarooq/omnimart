import { Skeleton } from "@/components/ui/skeleton";

export function InventorySummarySkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-lg border p-4 space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

export function InventoryTableSkeleton() {
  return (
    <div className="rounded-md border">
      <div className="p-3 border-b">
        <div className="grid grid-cols-7 gap-4">
          {["Product", "SKU", "Stock", "Min", "Status", "Value", ""].map((h) => (
            <Skeleton key={h} className="h-4 w-full" />
          ))}
        </div>
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="p-3 border-b last:border-0">
          <div className="grid grid-cols-7 gap-4 items-center">
            <div className="space-y-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-12 ml-auto" />
            <Skeleton className="h-4 w-8 ml-auto" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-4 w-16 ml-auto" />
            <div className="flex gap-1 justify-end">
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-8" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
