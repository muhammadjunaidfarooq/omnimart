import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser, getExpiryOverview } from "@/lib/api";
import { ExpiryTable } from "@/components/expiry/expiry-table";
import { ExpiryTableSkeleton } from "@/components/expiry/expiry-skeleton";

async function TableSection() {
  const initialData = await getExpiryOverview({ page: 1, pageSize: 20 });
  return <ExpiryTable initialData={initialData} />;
}

export default async function ExpiryPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Expiry</h1>
        <p className="text-muted-foreground">
          Stock batches by expiry date, soonest first — spot what&apos;s expired or about to expire.
        </p>
      </div>
      <Suspense fallback={<ExpiryTableSkeleton />}>
        <TableSection />
      </Suspense>
    </div>
  );
}
