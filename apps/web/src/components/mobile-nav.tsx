"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NavList } from "@/components/nav-list";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { Role } from "@/lib/auth";

export function MobileNav({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu" />
        }
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-72 gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground [&_svg]:text-sidebar-foreground"
      >
        <SheetHeader className="flex-row items-center gap-2 px-6 py-4">
          <span className="flex size-7 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-sm font-semibold">
            I
          </span>
          <SheetTitle className="font-semibold tracking-tight text-sidebar-foreground">
            OmniMart <span className="font-normal text-sidebar-foreground/60">POS</span>
          </SheetTitle>
        </SheetHeader>
        <NavList role={role} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
