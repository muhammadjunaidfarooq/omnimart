import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { UserMenu } from "@/components/user-menu";
import { Badge } from "@/components/ui/badge";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    // Not a plain redirect("/login") — a Server Component can't clear cookies
    // itself, and the stale-but-unexpired token would still be sitting there
    // for the middleware to see and bounce straight back to /admin or
    // /cashier. /auth/session-expired clears both cookies first.
    redirect("/auth/session-expired");
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar role={user.role} />
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/60 md:px-6 print:hidden">
          <div className="flex items-center gap-2">
            <MobileNav role={user.role} />
            <div className="text-sm font-medium text-muted-foreground">
              {user.role === "ADMIN" ? "Admin workspace" : "Cashier workspace"}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary">{user.role}</Badge>
            <UserMenu user={user} />
          </div>
        </header>
        <main className="flex flex-1 flex-col p-6">{children}</main>
      </div>
    </div>
  );
}
