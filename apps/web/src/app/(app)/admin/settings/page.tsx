import { redirect } from "next/navigation";
import { getCurrentUser, getSettings } from "@/lib/api";
import { SettingsForm } from "@/components/admin/settings/settings-form";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    redirect("/login");
  }

  const settings = await getSettings();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Store branding, currency, and invoice defaults.</p>
      </div>
      <SettingsForm settings={settings} />
    </div>
  );
}
