import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/api";
import { BorrowersTable } from "@/components/khata/borrowers-table";

export default async function KhataPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Khata</h1>
        <p className="text-muted-foreground">Borrowers with outstanding credit sales.</p>
      </div>
      <BorrowersTable />
    </div>
  );
}
