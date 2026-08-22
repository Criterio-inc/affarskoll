"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import {
  LayoutDashboard,
  FileText,
  Receipt,
  Calculator,
  BookOpen,
} from "lucide-react";

const tabs = [
  { href: "/ekonomi", label: "Översikt", icon: LayoutDashboard, exact: true },
  { href: "/ekonomi/fakturor", label: "Fakturor", icon: FileText },
  { href: "/ekonomi/moms", label: "Momslogg", icon: Receipt },
  { href: "/ekonomi/kalkyl", label: "Kalkyl", icon: Calculator },
  { href: "/ekonomi/kunskap", label: "Kunskap", icon: BookOpen },
];

export default function EkonomiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ekonomi"
        description="Fakturor, momslogg, kalkyl och kunskapsstöd"
      />

      {/* Tabs */}
      <nav
        aria-label="Ekonomi-flikar"
        className="flex flex-wrap gap-2 border-b"
      >
        {tabs.map((tab) => {
          const isActive = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div>{children}</div>
    </div>
  );
}
