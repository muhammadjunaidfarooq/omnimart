import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/api";
import { UserManagement } from "@/components/admin/user-management";

export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    redirect("/login");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-muted-foreground">Manage admin and cashier accounts.</p>
      </div>
      <UserManagement currentUserId={user.id} />
    </div>
  );
}
