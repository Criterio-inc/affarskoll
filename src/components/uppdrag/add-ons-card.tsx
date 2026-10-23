"use client";

// Tilläggstillfällen på ett uppdrag: extra dagar utöver avtalet som faktureras
// separat, i förväg eller i efterhand. Status (fakturerad eller inte) läses ur
// fakturorna, så den kan aldrig glida isär från ekonomin.

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarPlus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpdateProject } from "@/hooks/use-projects";
import { useInvoicePackages } from "@/hooks/use-invoice-packages";
import {
  ADD_ON_DEFAULTS,
  addOnsTotal,
  invoicedAddOnMap,
  projectAddOns,
} from "@/lib/add-ons";
import { formatCurrency } from "@/lib/utils";
import type { AddOnKind, Project, ProjectAddOn } from "@/types/project";

interface AddOnsCardProps {
  project: Project;
  commissionRate: number; // effektiv sats för uppdraget (0 om undantaget)
}

export function AddOnsCard({ project, commissionRate }: AddOnsCardProps) {
  const updateProject = useUpdateProject();
  const { data: packages = [] } = useInvoicePackages();
  const addOns = projectAddOns(project);
  const invoiced = useMemo(
    () => invoicedAddOnMap(packages, project.id),
    [packages, project.id]
  );

  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<AddOnKind>("heldag");
  const [date, setDate] = useState("");
  const [price, setPrice] = useState(String(ADD_ON_DEFAULTS.heldag.price));
  const [hours, setHours] = useState(String(ADD_ON_DEFAULTS.heldag.hours));
  const [description, setDescription] = useState("");

  const sorted = [...addOns].sort((a, b) => a.date.localeCompare(b.date));
  const total = addOnsTotal(addOns);
  const invoicedTotal = addOns
    .filter((a) => invoiced.has(a.id))
    .reduce((s, a) => s + a.price, 0);

  function pickKind(k: AddOnKind) {
    setKind(k);
    setPrice(String(ADD_ON_DEFAULTS[k].price));
    setHours(String(ADD_ON_DEFAULTS[k].hours));
  }

  async function save(next: ProjectAddOn[], message: string) {
    try {
      await updateProject.mutateAsync({ id: project.id, addOns: next });
      toast.success(message);
    } catch {
      toast.error("Kunde inte spara tilläggen");
    }
  }

  async function handleAdd() {
    const p = Number(price);
    if (!date) return toast.error("Ange datum för tillfället");
    if (!(p > 0)) return toast.error("Ange ett pris");
    if (kind === "annat" && !description.trim())
      return toast.error("Beskriv tillägget");
    const item: ProjectAddOn = {
      id: crypto.randomUUID(),
      kind,
      description: description.trim(),
      date,
      price: p,
      hours: Number(hours) || 0,
    };
    await save([...addOns, item], "Tillägget är sparat");
    setAdding(false);
    setDate("");
    setDescription("");
  }

  async function handleRemove(a: ProjectAddOn) {
    if (invoiced.has(a.id)) {
      toast.error("Tillägget är fakturerat. Kreditera fakturan först.");
      return;
    }
    await save(
      addOns.filter((x) => x.id !== a.id),
      "Tillägget är borttaget"
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarPlus className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Tilläggstillfällen</CardTitle>
          </div>
          {!adding && (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Lägg till
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {sorted.length === 0 && !adding && (
          <p className="text-muted-foreground">
            Extra tillfällen utöver avtalet, t.ex. utbildningsdagar som kunden
            beställer i efterhand. De faktureras för sig, i förväg eller efteråt.
          </p>
        )}

        {sorted.map((a) => {
          const isInvoiced = invoiced.has(a.id);
          const nr = invoiced.get(a.id);
          return (
            <div key={a.id} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium truncate">
                  {a.description || ADD_ON_DEFAULTS[a.kind].label}
                </div>
                <div className="text-xs text-muted-foreground">
                  {a.date} · {ADD_ON_DEFAULTS[a.kind].label}
                  {a.hours > 0 && ` · ${a.hours} h`}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span>{formatCurrency(a.price)}</span>
                {isInvoiced ? (
                  <Badge variant="secondary">
                    Fakturerad{nr ? ` #${nr}` : ""}
                  </Badge>
                ) : (
                  <Badge variant="outline">Ej fakturerad</Badge>
                )}
                {!isInvoiced && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => handleRemove(a)}
                    aria-label="Ta bort tillägg"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}

        {adding && (
          <div className="rounded-md border p-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Typ</Label>
                <Select value={kind} onValueChange={(v) => pickKind(v as AddOnKind)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="halvdag">Halvdag</SelectItem>
                    <SelectItem value="heldag">Heldag</SelectItem>
                    <SelectItem value="annat">Annat</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Datum</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Pris (före provision)</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Timmar (uppskattning)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                Beskrivning {kind !== "annat" && "(valfri)"}
              </Label>
              <Input
                value={description}
                placeholder="T.ex. Extra utbildningstillfälle, grupp 3"
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                Avbryt
              </Button>
              <Button size="sm" onClick={handleAdd} disabled={updateProject.isPending}>
                Spara tillägg
              </Button>
            </div>
          </div>
        )}

        {sorted.length > 0 && (
          <div className="border-t pt-2 space-y-1">
            <div className="flex justify-between font-medium">
              <span>Summa tillägg</span>
              <span>{formatCurrency(total)}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Netto efter provision</span>
              <span>{formatCurrency(Math.round(total * (1 - commissionRate)))}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Varav fakturerat</span>
              <span>{formatCurrency(invoicedTotal)}</span>
            </div>
            {total > invoicedTotal && (
              <Link
                href={`/ekonomi/fakturor/ny?projectId=${project.id}`}
                className="text-xs text-primary underline-offset-2 hover:underline"
              >
                Fakturera tillägg
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
