import { NavList } from "@/components/nav-list";
import type { Role } from "@/lib/auth";

export function Sidebar({ role }: { role: Role }) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex print:hidden">
      <div className="flex h-14 items-center gap-2 px-6 font-semibold tracking-tight">
        <span className="flex size-7 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-sm">
          I
        </span>
        <span>
          IMS <span className="font-normal text-sidebar-foreground/60">POS</span>
        </span>
      </div>
      <NavList role={role} />
    </aside>
  );
}
