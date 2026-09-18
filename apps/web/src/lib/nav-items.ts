import {
  Boxes,
  CalendarClock,
  HandCoins,
  LayoutDashboard,
  Receipt,
  Settings,
  ShoppingCart,
  Tags,
  Users,
  Wallet,
} from "lucide-react";
import type { Role } from "@/lib/auth";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const NAV_ITEMS: Record<Role, NavItem[]> = {
  ADMIN: [
    { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { label: "Catalog", href: "/admin/catalog", icon: Tags },
    { label: "Inventory", href: "/admin/inventory", icon: Boxes },
    { label: "Sales", href: "/admin/sales", icon: ShoppingCart },
    { label: "Khata", href: "/khata", icon: HandCoins },
    { label: "Expiry", href: "/expiry", icon: CalendarClock },
    { label: "Expenses", href: "/admin/expenses", icon: Receipt },
    { label: "Services", href: "/admin/services", icon: Wallet },
    { label: "Users", href: "/admin/users", icon: Users },
    { label: "Settings", href: "/admin/settings", icon: Settings },
  ],
  CASHIER: [
    { label: "Dashboard", href: "/cashier", icon: LayoutDashboard },
    { label: "Sales History", href: "/cashier/sales", icon: ShoppingCart },
    { label: "Khata", href: "/khata", icon: HandCoins },
    { label: "Expiry", href: "/expiry", icon: CalendarClock },
  ],
};

export function isNavItemActive(pathname: string, href: string) {
  return href === "/admin" || href === "/cashier" ? pathname === href : pathname.startsWith(href);
}
