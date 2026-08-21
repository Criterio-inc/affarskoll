"use client";

import { useMemo } from "react";
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
import {
  Receipt,
  FileText,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ArrowRight,
  Plus,
} from "lucide-react";
import { useInvoicePackages } from "@/hooks/use-invoice-packages";
import { useVatEvents, calculateVatSummary } from "@/hooks/use-vat-events";
import { useSettings } from "@/hooks/use-settings";
import { getSafeSettings } from "@/lib/settings";
import { formatCurrency } from "@/lib/utils";
import { LiquidityCard } from "@/components/ekonomi/liquidity-card";

const STATUS_LABELS: Record<string, string> = {
  utkast: "Utkast",
  skickad: "Skickad",
  betald: "Betald",
  krediterad: "Krediterad",
};

export default function EkonomiOversiktPage() {
  const currentYear = new Date().getFullYear();
  const { data: invoices = [] } = useInvoicePackages();
  const { data: vatEvents = [] } = useVatEvents(currentYear);
  const { data: settings } = useSettings();

  const safeSettings = getSafeSettings(settings);
  const summary = useMemo(
    () => calculateVatSummary(vatEvents),
    [vatEvents]
  );

  const unpaidInvoices = useMemo(
    () => invoices.filter((i) => i.status === "skickad"),
    [invoices]
  );
  const unpaidTotal = unpaidInvoices.reduce(
    (sum, i) => sum + Number(i.totalInclVat ?? 0),
    0
  );

  const draftInvoices = invoices.filter((i) => i.status === "utkast");
  const recentInvoices = invoices.slice(0, 5);
  const recentVatEvents = vatEvents.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* KPI-rad */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-medium">Utgående moms {currentYear}</span>
            </div>
            <p className="text-xl font-bold">
              {formatCurrency(summary.totalOutgoing)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingDown className="w-4 h-4" />
              <span className="text-xs font-medium">Ingående moms {currentYear}</span>
            </div>
            <p className="text-xl font-bold">
              {formatCurrency(summary.totalIncoming)}
            </p>
          </CardContent>
        </Card>

        <Card
          className={
            summary.netToPay > 0
              ? "border-amber-500/40 bg-amber-500/5"
              : "border-green-500/40 bg-green-500/5"
          }
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Receipt className="w-4 h-4" />
              <span className="text-xs font-medium">
                {summary.netToPay >= 0 ? "Att betala SKV" : "Att återfå från SKV"}
              </span>
            </div>
            <p
              className={`text-xl font-bold ${
                summary.netToPay > 0 ? "text-amber-700" : "text-green-700"
              }`}
            >
              {formatCurrency(Math.abs(summary.netToPay))}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <FileText className="w-4 h-4" />
              <span className="text-xs font-medium">Obetalda fakturor</span>
            </div>
            <p className="text-xl font-bold">
              {formatCurrency(unpaidTotal)}
            </p>
            <p className="text-xs text-muted-foreground">
              {unpaidInvoices.length} st
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sätt undan / likviditet */}
      <LiquidityCard />

      {/* Info om momsperiod */}
      {safeSettings.vatReportingPeriod === "yearly" && (
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="py-3 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium">Du har årsmoms</p>
              <p className="text-muted-foreground">
                Eftersom du är aktiebolag med kalenderår, helårsmoms och utan EU-handel deklareras momsen <strong>i anslutning till inkomstdeklarationen</strong> — senast omkring <strong>1–17 augusti {currentYear + 1}</strong> (samma deadline som INK2).
                {safeSettings.vatAccountingMethod === "cash" && (
                  <>
                    {" "}Vid kontantmetoden räknas en faktura först när den är <strong>betald</strong> (inte när du skickar den).
                  </>
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {safeSettings.vatReportingPeriod === "quarterly" && (
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="py-3 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium">Du har kvartalsmoms</p>
              <p className="text-muted-foreground">
                Momsdeklarationen lämnas kvartalsvis. Deadlines: <strong>12 maj, 17 aug, 12 nov, 12 feb</strong> (för föregående kvartal).
                {safeSettings.vatAccountingMethod === "cash" && (
                  <> Vid kontantmetoden räknas faktura först när den är <strong>betald</strong>.</>
                )}
              </p>
              {safeSettings.vatQuarterlyFromYear && (
                <p className="text-muted-foreground mt-1">
                  Övergångsår <strong>{safeSettings.vatQuarterlyFromYear}</strong>:
                  Q1 och Q2 deklareras tillsammans senast <strong>17 augusti {safeSettings.vatQuarterlyFromYear}</strong>.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {safeSettings.vatReportingPeriod === "monthly" && (
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="py-3 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium">Du har månadsmoms</p>
              <p className="text-muted-foreground">
                Momsdeklarationen lämnas varje månad — <strong>senast 26:e i månaden</strong> efter redovisningsperioden.
                {safeSettings.vatAccountingMethod === "cash" && (
                  <> Vid kontantmetoden räknas faktura först när den är <strong>betald</strong>.</>
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Snabbåtgärder */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/ekonomi/fakturor">
          <Card className="hover:border-primary/40 transition-colors cursor-pointer h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Fakturor
                </CardTitle>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </div>
              <CardDescription>
                {invoices.length} totalt · {draftInvoices.length} utkast · {unpaidInvoices.length} skickade
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/ekonomi/moms">
          <Card className="hover:border-primary/40 transition-colors cursor-pointer h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Receipt className="w-4 h-4" />
                  Momslogg {currentYear}
                </CardTitle>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </div>
              <CardDescription>
                {summary.eventCount} händelser · netto {formatCurrency(summary.netToPay)} till SKV
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

      {/* Senaste fakturor */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Senaste fakturapaket</CardTitle>
            <CardDescription>De fem senaste</CardDescription>
          </div>
          <Button asChild size="sm">
            <Link href="/ekonomi/fakturor/ny">
              <Plus className="w-4 h-4 mr-1" />
              Nytt paket
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentInvoices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Inga fakturapaket ännu. Skapa det första från ett uppdrag.
            </p>
          ) : (
            <div className="space-y-2">
              {recentInvoices.map((inv) => (
                <Link
                  key={inv.id}
                  href={`/ekonomi/fakturor/${inv.id}`}
                  className="flex items-center justify-between p-2 rounded-md border hover:bg-muted/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {inv.projectTitle ?? inv.customerName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {inv.customerName}
                      {inv.dooerInvoiceNumber ? ` · ${inv.dooerInvoiceNumber}` : ""}
                    </p>
                  </div>
                  <div className="text-right ml-2">
                    <p className="font-semibold text-sm">
                      {formatCurrency(Number(inv.totalInclVat))}
                    </p>
                    <Badge
                      variant={
                        inv.status === "betald"
                          ? "success"
                          : inv.status === "skickad"
                          ? "warning"
                          : "outline"
                      }
                      className="text-[10px]"
                    >
                      {STATUS_LABELS[inv.status] ?? inv.status}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Senaste moms-händelser */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Senaste moms-händelser</CardTitle>
          <CardDescription>De fem senaste i momsloggen</CardDescription>
        </CardHeader>
        <CardContent>
          {recentVatEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Inga moms-händelser ännu.
            </p>
          ) : (
            <div className="space-y-2">
              {recentVatEvents.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between p-2 rounded-md border"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {e.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {e.eventDate}
                      {e.basAccount ? ` · ${e.basAccount}` : ""}
                    </p>
                  </div>
                  <div className="text-right ml-2 text-xs">
                    {Number(e.outgoingVat) > 0 && (
                      <p className="text-amber-600">
                        +{formatCurrency(Number(e.outgoingVat))}
                      </p>
                    )}
                    {Number(e.incomingVat) > 0 && (
                      <p className="text-green-600">
                        -{formatCurrency(Number(e.incomingVat))}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
