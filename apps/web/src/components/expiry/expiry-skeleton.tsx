import { Skeleton } from "@/components/ui/skeleton";

export function ExpiryTableSkeleton() {
  return (
    <div className="rounded-md border">
      <div className="p-3 border-b">
        <div className="grid grid-cols-5 gap-4">
          {["Product", "SKU", "Remaining", "Expiry Date", "Status"].map((h) => (
            <Skeleton key={h} className="h-4 w-full" />
          ))}
        </div>
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="p-3 border-b last:border-0">
          <div className="grid grid-cols-5 gap-4 items-center">
            <div className="space-y-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-12 ml-auto" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
