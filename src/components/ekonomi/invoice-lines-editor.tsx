"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2 } from "lucide-react";
import {
  type InvoiceLine,
  lineAmount,
  sumLines,
  newLineId,
} from "@/types/invoice";
import { formatCurrency } from "@/lib/utils";

interface InvoiceLinesEditorProps {
  lines: InvoiceLine[];
  onChange: (lines: InvoiceLine[]) => void;
}

// Redigerbara fakturarader (benämning, antal, enhet, à-pris) med radsumma
// och totalsumma. Beloppen räknas alltid ur raderna — ingen egen state.
export function InvoiceLinesEditor({ lines, onChange }: InvoiceLinesEditorProps) {
  function updateLine(id: string, patch: Partial<InvoiceLine>) {
    onChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function addLine() {
    onChange([
      ...lines,
      { id: newLineId(), description: "", quantity: 1, unit: "st", unitPrice: 0 },
    ]);
  }

  function removeLine(id: string) {
    onChange(lines.filter((l) => l.id !== id));
  }

  return (
    <div className="space-y-3">
      {/* Kolumnrubriker (döljs på mobil — där stackas fälten) */}
      <div className="hidden sm:grid sm:grid-cols-[1fr_5rem_5.5rem_7rem_6.5rem_2rem] gap-2 text-xs text-muted-foreground px-0.5">
        <span>Benämning</span>
        <span>Antal</span>
        <span>Enhet</span>
        <span>À-pris (kr)</span>
        <span className="text-right">Summa</span>
        <span />
      </div>

      {lines.map((line) => (
        <div
          key={line.id}
          className="grid grid-cols-2 sm:grid-cols-[1fr_5rem_5.5rem_7rem_6.5rem_2rem] gap-2 items-center rounded-md border p-2 sm:border-0 sm:p-0"
        >
          <Input
            className="col-span-2 sm:col-span-1"
            placeholder="t.ex. Konsultuppdrag"
            value={line.description}
            onChange={(e) => updateLine(line.id, { description: e.target.value })}
          />
          <Input
            type="number"
            step="0.5"
            value={line.quantity}
            onChange={(e) =>
              updateLine(line.id, { quantity: Number(e.target.value) || 0 })
            }
          />
          <Input
            placeholder="timmar"
            value={line.unit}
            onChange={(e) => updateLine(line.id, { unit: e.target.value })}
          />
          <Input
            type="number"
            step="0.01"
            value={line.unitPrice}
            onChange={(e) =>
              updateLine(line.id, { unitPrice: Number(e.target.value) || 0 })
            }
          />
          <span className="text-sm text-right tabular-nums">
            {formatCurrency(lineAmount(line))}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => removeLine(line.id)}
            disabled={lines.length <= 1}
            title="Ta bort rad"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}

      <Button variant="outline" size="sm" onClick={addLine}>
        <Plus className="w-4 h-4 mr-1" />
        Lägg till rad
      </Button>

      <Separator />
      <div className="flex justify-between text-sm font-medium">
        <span>Belopp exklusive moms</span>
        <span className="tabular-nums">{formatCurrency(sumLines(lines))}</span>
      </div>
    </div>
  );
}
