import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/api";
import { ProfileForm } from "@/components/profile-form";
import { ChangePasswordForm } from "@/components/change-password-form";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">Manage your account details.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileForm user={user} />
        <ChangePasswordForm />
      </div>
    </div>
  );
}
