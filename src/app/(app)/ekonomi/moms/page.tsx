"use client";

import { useState, useMemo } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Receipt,
  Trash2,
  Pencil,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  useVatEvents,
  useDeleteVatEvent,
  calculateVatSummary,
  type VatEvent,
  type VatEventType,
} from "@/hooks/use-vat-events";
import { formatCurrency } from "@/lib/utils";
import { VatEventForm } from "@/components/ekonomi/vat-event-form";
import { useSettings } from "@/hooks/use-settings";
import { getSafeSettings } from "@/lib/settings";
import {
  getVatOccasions,
  eventInOccasion,
  nextUpcomingOccasion,
  formatDeadlineSv,
} from "@/lib/vat";
import { toast } from "sonner";

const eventTypeLabels: Record<VatEventType, string> = {
  sales: "Försäljning",
  purchase_se: "Inköp Sverige",
  purchase_eu: "Inköp EU",
  purchase_non_eu: "Inköp utanför EU",
  reverse_charge: "Omvänd skattskyldighet",
  other: "Annat",
};

const eventTypeColors: Record<VatEventType, string> = {
  sales: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  purchase_se: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  purchase_eu: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  purchase_non_eu: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  reverse_charge: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

export default function MomsloggPage() {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editEvent, setEditEvent] = useState<VatEvent | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: events = [], isLoading } = useVatEvents(year);
  const deleteEvent = useDeleteVatEvent();
  const { data: settingsData } = useSettings();
  const settings = getSafeSettings(settingsData);

  const summary = useMemo(() => calculateVatSummary(events), [events]);

  // Deklarationstillfällen för året enligt redovisningsperiod
  const occasions = useMemo(
    () =>
      getVatOccasions(
        year,
        settings.vatReportingPeriod,
        settings.vatQuarterlyFromYear
      ),
    [year, settings.vatReportingPeriod, settings.vatQuarterlyFromYear]
  );

  // Per-tillfälle-summering (utg/ing/netto) genom att filtrera årets händelser
  const occasionSummaries = useMemo(
    () =>
      occasions.map((o) => ({
        occasion: o,
        summary: calculateVatSummary(
          events.filter((e) => eventInOccasion(e.eventDate, o, year))
        ),
      })),
    [occasions, events, year]
  );

  const todayIso = new Date().toISOString().slice(0, 10);
  const nextOccasion = nextUpcomingOccasion(occasions, todayIso);
  const isQuarterly = settings.vatReportingPeriod === "quarterly";

  // Året-spann för dropdown (3 år bakåt + nuvarande + 1 år framåt)
  const currentYear = new Date().getFullYear();
  const yearOptions = [
    currentYear + 1,
    currentYear,
    currentYear - 1,
    currentYear - 2,
    currentYear - 3,
  ];

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteEvent.mutateAsync(deleteId);
      toast.success("Moms-händelse borttagen");
      setDeleteId(null);
    } catch {
      toast.error("Kunde inte ta bort");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header med år-väljare och knapp */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Beskattningsår:</span>
          <Select
            value={String(year)}
            onValueChange={(v) => setYear(Number(v))}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Ny moms-händelse
        </Button>
      </div>

      {/* Saldo-kort */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-medium">Utgående moms</span>
            </div>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">
              {formatCurrency(summary.totalOutgoing)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Du har tagit in moms från kunder
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingDown className="w-4 h-4" />
              <span className="text-xs font-medium">Ingående moms</span>
            </div>
            <p className="text-2xl font-bold text-green-700 dark:text-green-400">
              {formatCurrency(summary.totalIncoming)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Avdragsgill — du får tillbaka
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
                {summary.netToPay >= 0
                  ? "Att betala till SKV"
                  : "Att återfå från SKV"}
              </span>
            </div>
            <p
              className={`text-2xl font-bold ${
                summary.netToPay > 0 ? "text-amber-700" : "text-green-700"
              }`}
            >
              {formatCurrency(Math.abs(summary.netToPay))}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {settings.vatReportingPeriod === "yearly"
                ? `Deklareras omkring 1–17 augusti ${year + 1}`
                : settings.vatReportingPeriod === "quarterly"
                ? "Deklareras kvartalsvis — se uppdelning nedan"
                : "Deklareras månadsvis"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Kvartalsuppdelning */}
      {isQuarterly && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Per kvartal {year}</CardTitle>
            <CardDescription>
              Vad som ska deklareras och betalas vid varje tillfälle. Nästa
              deadline är markerad.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {occasionSummaries.map(({ occasion, summary: s }) => {
                const isNext = nextOccasion?.key === occasion.key;
                const passed = occasion.deadline < todayIso;
                return (
                  <div
                    key={occasion.key}
                    className={`rounded-md border p-3 space-y-2 ${
                      isNext
                        ? "border-amber-500/50 bg-amber-500/5"
                        : passed
                        ? "opacity-70"
                        : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm">
                        {occasion.label}
                      </span>
                      {isNext && (
                        <Badge variant="warning" className="text-[10px]">
                          Nästa
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Deadline {formatDeadlineSv(occasion.deadline)}
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Utgående</span>
                      <span>{formatCurrency(s.totalOutgoing)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Ingående</span>
                      <span>{formatCurrency(s.totalIncoming)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold border-t pt-1">
                      <span>
                        {s.netToPay >= 0 ? "Att betala" : "Att återfå"}
                      </span>
                      <span
                        className={
                          s.netToPay > 0 ? "text-amber-700" : "text-green-700"
                        }
                      >
                        {formatCurrency(Math.abs(s.netToPay))}
                      </span>
                    </div>
                    {occasion.note && (
                      <p className="text-[11px] text-muted-foreground border-t pt-1">
                        {occasion.note}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista över händelser */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Händelser {year}
            <Badge variant="outline" className="ml-2">
              {events.length}
            </Badge>
          </CardTitle>
          <CardDescription>
            Alla moms-relaterade händelser sorterade efter datum
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Laddar...</p>
          ) : events.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                Inga moms-händelser för {year} ännu.
              </p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="w-4 h-4 mr-1" />
                Lägg till första händelsen
              </Button>
            </div>
          ) : (
            <div className="space-y-1">
              {events.map((e) => (
                <VatEventRow
                  key={e.id}
                  event={e}
                  onEdit={() => setEditEvent(e)}
                  onDelete={() => setDeleteId(e.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lägg till-dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ny moms-händelse</DialogTitle>
            <DialogDescription>
              Logga en moms-relaterad händelse — försäljning, inköp eller annat
            </DialogDescription>
          </DialogHeader>
          <VatEventForm
            onSuccess={() => {
              setShowAddDialog(false);
              toast.success("Moms-händelse sparad");
            }}
            onCancel={() => setShowAddDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Redigera-dialog */}
      <Dialog
        open={!!editEvent}
        onOpenChange={(o) => !o && setEditEvent(null)}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Redigera moms-händelse</DialogTitle>
            <DialogDescription>
              Justera datum, belopp, kund, konto eller annan info
            </DialogDescription>
          </DialogHeader>
          {editEvent && (
            <VatEventForm
              key={editEvent.id}
              initialValue={editEvent}
              onSuccess={() => setEditEvent(null)}
              onCancel={() => setEditEvent(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Bekräfta borttagning */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort moms-händelse?</AlertDialogTitle>
            <AlertDialogDescription>
              Detta kan inte ångras. Saldot för året kommer att räknas om.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Ta bort</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function VatEventRow({
  event,
  onEdit,
  onDelete,
}: {
  event: VatEvent;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const outgoing = Number(event.outgoingVat ?? 0);
  const incoming = Number(event.incomingVat ?? 0);
  const isReverseCharge = outgoing > 0 && incoming > 0 && Math.abs(outgoing - incoming) < 0.01;

  return (
    <div className="flex items-start justify-between gap-3 p-3 rounded-md border hover:bg-muted/30 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-xs text-muted-foreground font-mono">
            {event.eventDate}
          </span>
          <Badge
            variant="outline"
            className={`text-[10px] ${eventTypeColors[event.eventType]}`}
          >
            {eventTypeLabels[event.eventType]}
          </Badge>
          {event.basAccount && (
            <Badge variant="outline" className="text-[10px] font-mono">
              {event.basAccount}
            </Badge>
          )}
          {isReverseCharge && (
            <Badge variant="outline" className="text-[10px]">
              omvänd
            </Badge>
          )}
        </div>
        <p className="text-sm font-medium truncate">{event.description}</p>
        {event.supplier && (
          <p className="text-xs text-muted-foreground truncate">
            {event.supplier}
          </p>
        )}
      </div>
      <div className="text-right text-xs whitespace-nowrap">
        <p className="text-muted-foreground">
          {formatCurrency(Number(event.amountSek))} ({Math.round(Number(event.vatRate) * 100)} %)
        </p>
        {outgoing > 0 && (
          <p className="text-amber-600 font-medium">
            +{formatCurrency(outgoing)} utg
          </p>
        )}
        {incoming > 0 && (
          <p className="text-green-600 font-medium">
            -{formatCurrency(incoming)} ing
          </p>
        )}
        {isReverseCharge && (
          <p className="text-muted-foreground italic">netto 0</p>
        )}
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-primary"
          onClick={onEdit}
          aria-label="Redigera moms-händelse"
        >
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
          aria-label="Ta bort moms-händelse"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
