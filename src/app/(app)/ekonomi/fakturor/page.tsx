"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Plus,
  Search,
  FileText,
  ArrowRight,
} from "lucide-react";
import { useInvoicePackages } from "@/hooks/use-invoice-packages";
import { formatCurrency } from "@/lib/utils";

type StatusFilter = "alla" | "utkast" | "skickad" | "betald" | "krediterad";

const statusLabels: Record<string, string> = {
  utkast: "Utkast",
  skickad: "Skickad",
  betald: "Betald",
  krediterad: "Krediterad",
};

const statusVariants: Record<string, "outline" | "warning" | "success" | "secondary"> = {
  utkast: "outline",
  skickad: "warning",
  betald: "success",
  krediterad: "secondary",
};

function formatDate(d: string | null): string {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleDateString("sv-SE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return d;
  }
}

export default function FakturaListaPage() {
  const { data: invoices = [], isLoading } = useInvoicePackages();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("alla");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let list = invoices;
    if (statusFilter !== "alla") {
      list = list.filter((i) => i.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          i.customerName.toLowerCase().includes(q) ||
          i.projectTitle?.toLowerCase().includes(q) ||
          i.externalInvoiceNumber?.toLowerCase().includes(q) ||
          (i.invoiceNumber != null && String(i.invoiceNumber).includes(q)) ||
          i.buyerName?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [invoices, statusFilter, search]);

  const counts = useMemo(() => {
    const c = { alla: invoices.length, utkast: 0, skickad: 0, betald: 0 };
    for (const i of invoices) {
      if (i.status === "utkast") c.utkast++;
      else if (i.status === "skickad") c.skickad++;
      else if (i.status === "betald") c.betald++;
    }
    return c;
  }, [invoices]);

  return (
    <div className="space-y-4">
      {/* Header med filter och knapp */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <Tabs
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
        >
          <TabsList>
            <TabsTrigger value="alla">Alla ({counts.alla})</TabsTrigger>
            <TabsTrigger value="utkast">Utkast ({counts.utkast})</TabsTrigger>
            <TabsTrigger value="skickad">Skickade ({counts.skickad})</TabsTrigger>
            <TabsTrigger value="betald">Betalda ({counts.betald})</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Sök kund eller faktura..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button asChild>
            <Link href="/ekonomi/fakturor/ny">
              <Plus className="w-4 h-4 mr-1" />
              Ny faktura
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Laddar...
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16">
            <FileText className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-1">Inga fakturapaket</h3>
            <p className="text-sm text-muted-foreground mb-4 text-center">
              Skapa ditt första fakturapaket från ett uppdrag.
            </p>
            <Button asChild>
              <Link href="/ekonomi/fakturor/ny">
                <Plus className="w-4 h-4 mr-1" />
                Nytt fakturapaket
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((inv) => {
            const theoretical = Number(inv.theoreticalAmount ?? 0);
            const actual = Number(inv.actualAmount ?? 0);
            const hasAdjustment =
              theoretical > 0 && Math.abs(theoretical - actual) > 0.5;
            return (
              <Link key={inv.id} href={`/ekonomi/fakturor/${inv.id}`}>
                <Card className="hover:border-primary/40 transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold truncate">
                            {inv.projectTitle ?? inv.customerName}
                          </h3>
                          <Badge variant={statusVariants[inv.status]}>
                            {statusLabels[inv.status]}
                          </Badge>
                          {hasAdjustment && (
                            <Badge variant="outline" className="text-[10px]">
                              avvikelse
                            </Badge>
                          )}
                          {inv.invoiceNumber != null && (
                            <Badge variant="outline" className="text-[10px] font-mono">
                              Faktura {inv.invoiceNumber}
                            </Badge>
                          )}
                          {inv.externalInvoiceNumber && (
                            <Badge variant="outline" className="text-[10px] font-mono">
                              {inv.externalInvoiceNumber}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {inv.customerName}
                          {inv.periodStart && inv.periodEnd && (
                            <>
                              {" · "}
                              {formatDate(inv.periodStart)}
                              {" – "}
                              {formatDate(inv.periodEnd)}
                            </>
                          )}
                        </p>
                        {inv.status === "betald" && inv.paidDate && (
                          <p className="text-xs text-green-600 mt-1">
                            Betald {formatDate(inv.paidDate)}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-lg">
                          {formatCurrency(Number(inv.totalInclVat))}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          inkl moms
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(actual)} +{" "}
                          {Math.round(Number(inv.vatRate) * 100)}%
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground self-center shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
