"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  LayoutDashboard,
  Briefcase,
  Clock,
  Users,
  Menu,
  X,
  Settings,
  Moon,
  Sun,
  Wallet,
  Car,
} from "lucide-react";
import { useTheme } from "next-themes";
import { UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { NotificationBell } from "./notification-bell";

const bottomNav = [
  { href: "/", label: "Hem", icon: LayoutDashboard },
  { href: "/uppdrag", label: "Uppdrag", icon: Briefcase },
  { href: "/tidsrapportering", label: "Tid", icon: Clock },
  { href: "/resor", label: "Resor", icon: Car },
];

const drawerNav = [
  { href: "/", label: "Översikt", icon: LayoutDashboard },
  { href: "/uppdrag", label: "Uppdrag", icon: Briefcase },
  { href: "/kunder", label: "Kunder", icon: Users },
  { href: "/tidsrapportering", label: "Tidsrapportering", icon: Clock },
  { href: "/aktivitet", label: "Aktivitet", icon: Activity },
  { href: "/resor", label: "Resor", icon: Car },
  { href: "/ekonomi", label: "Ekonomi", icon: Wallet },
  { href: "/installningar", label: "Inställningar", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Top bar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-b h-14 flex items-center px-4 justify-between">
        <button
          onClick={() => setOpen(true)}
          className="p-2 -ml-2"
          aria-label="Öppna meny"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="font-semibold text-sm">Affärskoll</span>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </header>

      {/* Drawer overlay */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-[60]">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-sidebar text-sidebar-foreground animate-slide-in">
            <div className="p-4 flex items-center justify-between border-b border-sidebar-border">
              <h2 className="font-bold text-sidebar-primary">Affärskoll</h2>
              <button onClick={() => setOpen(false)} aria-label="Stäng meny">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="p-3 space-y-1">
              {drawerNav.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-all",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-primary font-medium"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="absolute bottom-4 left-3 right-3">
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm w-full text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
              >
                {theme === "dark" ? (
                  <Sun className="w-5 h-5" />
                ) : (
                  <Moon className="w-5 h-5" />
                )}
                <span>{theme === "dark" ? "Ljust tema" : "Mörkt tema"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom navigation */}
      <nav aria-label="Mobilnavigering" className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-t safe-area-bottom">
        <div className="flex justify-around py-2">
          {bottomNav.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-1 text-xs transition-colors",
                  isActive
                    ? "text-primary font-medium"
                    : "text-muted-foreground"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
