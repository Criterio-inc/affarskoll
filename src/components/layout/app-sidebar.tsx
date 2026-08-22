"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  Activity,
  LayoutDashboard,
  Briefcase,
  Clock,
  Calculator,
  Users,
  Settings,
  Moon,
  Sun,
  Wallet,
  Car,
} from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { NotificationBell } from "./notification-bell";

const navItems = [
  { href: "/", label: "Översikt", icon: LayoutDashboard },
  { href: "/uppdrag", label: "Uppdrag", icon: Briefcase },
  { href: "/tidsrapportering", label: "Tidsrapportering", icon: Clock },
  { href: "/aktivitet", label: "Aktivitet", icon: Activity },
  { href: "/resor", label: "Resor", icon: Car },
  { href: "/kalkylator", label: "Kalkylator", icon: Calculator },
  { href: "/kunder", label: "Kunder", icon: Users },
  { href: "/ekonomi", label: "Ekonomi", icon: Wallet },
  { href: "/installningar", label: "Inställningar", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border h-screen sticky top-0">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <h1 className="text-xl font-bold text-sidebar-primary">
          Affärskoll
        </h1>
        <p className="text-xs text-sidebar-foreground/60 mt-1">
          Konsulthantering
        </p>
      </div>

      {/* Navigation */}
      <nav aria-label="Huvudnavigering" className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border space-y-2">
        <div className="flex items-center justify-between px-3">
          <NotificationBell />
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2 rounded-lg text-sidebar-foreground/60 hover:bg-sidebar-accent/50 transition-colors"
            aria-label="Byt tema"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>
        </div>
        <div className="flex items-center gap-3 px-3 py-2">
          <UserButton
            afterSignOutUrl="/sign-in"
            appearance={{
              elements: {
                avatarBox: "w-8 h-8",
              },
            }}
          />
          <span className="text-xs text-sidebar-foreground/60 truncate">
            Mitt konto
          </span>
        </div>
      </div>
    </aside>
  );
}
