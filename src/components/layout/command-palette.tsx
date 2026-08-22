"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  Activity,
  LayoutDashboard,
  Briefcase,
  Clock,
  Calculator,
  Users,
  FileText,
  Settings,
  Plus,
  Search,
  Wallet,
  Receipt,
  BookOpen,
  Car,
  Sparkles,
} from "lucide-react";
import { useProjects } from "@/hooks/use-projects";
import { useCustomers } from "@/hooks/use-customers";

const pages = [
  { name: "Översikt", href: "/", icon: LayoutDashboard, keywords: "dashboard hem start" },
  { name: "Uppdrag", href: "/uppdrag", icon: Briefcase, keywords: "projekt" },
  { name: "Nytt uppdrag", href: "/uppdrag/nytt", icon: Plus, keywords: "skapa ny projekt" },
  { name: "Tidsrapportering", href: "/tidsrapportering", icon: Clock, keywords: "tid timmar vecka" },
  { name: "Aktivitet", href: "/aktivitet", icon: Activity, keywords: "statistik heatmap svit streak aktiva dagar" },
  { name: "Resor", href: "/resor", icon: Car, keywords: "resa mil km kilometerersättning parkering kvitto utlägg" },
  { name: "Kalkylator", href: "/kalkylator", icon: Calculator, keywords: "jämför nettolön kalkyl" },
  { name: "Kunder", href: "/kunder", icon: Users, keywords: "kund kontakt" },
  { name: "Ekonomi — översikt", href: "/ekonomi", icon: Wallet, keywords: "moms faktura kassa" },
  { name: "Ekonomi — fakturor", href: "/ekonomi/fakturor", icon: FileText, keywords: "fakturapaket dooer invoice" },
  { name: "Nytt fakturapaket", href: "/ekonomi/fakturor/ny", icon: Plus, keywords: "skapa faktura historiskt" },
  { name: "Ekonomi — momslogg", href: "/ekonomi/moms", icon: Receipt, keywords: "moms skatteverket vat" },
  { name: "Ekonomi — kunskap", href: "/ekonomi/kunskap", icon: BookOpen, keywords: "bas konton scenario hjälp" },
  { name: "Inställningar", href: "/installningar", icon: Settings, keywords: "config skatt kommun moms" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { data: projects = [] } = useProjects();
  const { data: customers = [] } = useCustomers();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      <div className="absolute top-[15%] left-1/2 -translate-x-1/2 w-full max-w-lg px-4">
        <Command className="bg-popover border rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center border-b px-4">
            <Search className="w-4 h-4 text-muted-foreground mr-2 shrink-0" />
            <Command.Input
              autoFocus
              placeholder="Sök sidor, uppdrag, kunder..."
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Command.List className="max-h-96 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              Inga resultat hittades.
            </Command.Empty>

            <Command.Group heading="Sidor" className="text-xs text-muted-foreground px-2 py-1.5">
              {pages.map((page) => (
                <Command.Item
                  key={page.href}
                  value={`${page.name} ${page.keywords}`}
                  onSelect={() => navigate(page.href)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground"
                >
                  <page.icon className="w-4 h-4 text-muted-foreground" />
                  <span>{page.name}</span>
                </Command.Item>
              ))}
            </Command.Group>

            {projects.length > 0 && (
              <Command.Group heading="Uppdrag" className="text-xs text-muted-foreground px-2 py-1.5 mt-2">
                {projects.slice(0, 30).map((p) => (
                  <Command.Item
                    key={`p-${p.id}`}
                    value={`uppdrag ${p.title} ${p.customerName}`}
                    onSelect={() => navigate(`/uppdrag/${p.id}`)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground"
                  >
                    <Briefcase className="w-4 h-4 text-muted-foreground" />
                    <span className="flex-1 truncate">{p.title}</span>
                    <span className="text-xs text-muted-foreground truncate ml-2">
                      {p.customerName}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {customers.length > 0 && (
              <Command.Group heading="Kunder" className="text-xs text-muted-foreground px-2 py-1.5 mt-2">
                {customers.slice(0, 30).map((c) => (
                  <Command.Item
                    key={`c-${c.id}`}
                    value={`kund ${c.name} ${c.contactPerson ?? ""}`}
                    onSelect={() => navigate(`/kunder`)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground"
                  >
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="flex-1 truncate">{c.name}</span>
                    {c.contactPerson && (
                      <span className="text-xs text-muted-foreground truncate ml-2">
                        {c.contactPerson}
                      </span>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
          <div className="border-t px-4 py-2 text-xs text-muted-foreground flex items-center gap-4">
            <span>
              <kbd className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono">↵</kbd> Välj
            </span>
            <span>
              <kbd className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono">Esc</kbd> Stäng
            </span>
            <span className="ml-auto flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <kbd className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono">⌘J</kbd> AI
            </span>
          </div>
        </Command>
      </div>
    </div>
  );
}
