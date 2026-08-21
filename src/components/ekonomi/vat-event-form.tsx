"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, BookOpen } from "lucide-react";
import {
  useCreateVatEvent,
  useUpdateVatEvent,
  type VatEventType,
  type VatEvent,
} from "@/hooks/use-vat-events";
import {
  searchScenarios,
  getScenarioByKey,
  BAS_ACCOUNTS,
  type VatScenario,
} from "@/data/vat-scenarios";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

interface VatEventFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  defaultDate?: string;
  /** Om angivet → redigera-läge. Annars skapa-läge. */
  initialValue?: VatEvent;
}

const ALL_BAS_KEYS = Object.keys(BAS_ACCOUNTS) as Array<keyof typeof BAS_ACCOUNTS>;

const eventTypeOptions: { value: VatEventType; label: string }[] = [
  { value: "purchase_se", label: "Inköp Sverige (vanlig moms)" },
  { value: "purchase_eu", label: "Inköp EU (omvänd skatt)" },
  { value: "purchase_non_eu", label: "Inköp utanför EU (omvänd skatt)" },
  { value: "sales", label: "Försäljning" },
  { value: "reverse_charge", label: "Omvänd skattskyldighet (övrigt)" },
  { value: "other", label: "Annat" },
];

export function VatEventForm({
  onSuccess,
  onCancel,
  defaultDate,
  initialValue,
}: VatEventFormProps) {
  const create = useCreateVatEvent();
  const update = useUpdateVatEvent();
  const isEditMode = !!initialValue;

  // Form state — förifylls från initialValue i redigera-läge
  const [eventDate, setEventDate] = useState(
    initialValue?.eventDate ??
      defaultDate ??
      new Date().toISOString().slice(0, 10)
  );
  const [description, setDescription] = useState(
    initialValue?.description ?? ""
  );
  const [supplier, setSupplier] = useState(initialValue?.supplier ?? "");
  const [amountSek, setAmountSek] = useState(
    initialValue ? String(Number(initialValue.amountSek)) : ""
  );
  const [vatRate, setVatRate] = useState(
    initialValue ? String(Number(initialValue.vatRate)) : "0.25"
  );
  const [eventType, setEventType] = useState<VatEventType>(
    initialValue?.eventType ?? "purchase_se"
  );
  const [basAccount, setBasAccount] = useState<string>(
    initialValue?.basAccount ?? ""
  );
  const [scenarioKey, setScenarioKey] = useState<string>(
    initialValue?.scenarioKey ?? ""
  );
  const [notes, setNotes] = useState(initialValue?.notes ?? "");

  // Scenario-sökning
  const [scenarioSearch, setScenarioSearch] = useState("");
  const matchingScenarios = useMemo(
    () => (scenarioSearch ? searchScenarios(scenarioSearch, 5) : []),
    [scenarioSearch]
  );

  // AI-fritext-läge
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  function applyScenario(scenario: VatScenario) {
    setScenarioKey(scenario.key);
    setEventType(
      scenario.category === "purchase_se"
        ? "purchase_se"
        : scenario.category === "purchase_eu"
        ? "purchase_eu"
        : scenario.category === "purchase_non_eu"
        ? "purchase_non_eu"
        : scenario.category === "sales"
        ? "sales"
        : scenario.reverseCharge
        ? "reverse_charge"
        : "purchase_se"
    );
    setVatRate(String(scenario.vatRate));
    if (scenario.expenseAccount) {
      setBasAccount(scenario.expenseAccount.number);
    }
    if (!description) {
      setDescription(scenario.title);
    }
    setScenarioSearch("");
    toast.success(`Scenario "${scenario.title}" tillämpat`);
  }

  async function handleAiSuggest() {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/parse-vat-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: aiPrompt }),
      });

      if (!res.ok) {
        throw new Error("AI-anrop misslyckades");
      }

      const parsed = await res.json();

      // Fyll i fält från AI-svaret
      if (parsed.eventDate) setEventDate(parsed.eventDate);
      if (parsed.description) setDescription(parsed.description);
      if (parsed.supplier) setSupplier(parsed.supplier);
      if (typeof parsed.amountSek === "number") {
        setAmountSek(String(parsed.amountSek));
      }
      if (typeof parsed.vatRate === "number") {
        setVatRate(String(parsed.vatRate));
      }
      if (parsed.eventType) setEventType(parsed.eventType);
      if (parsed.basAccount) setBasAccount(parsed.basAccount);
      if (parsed.scenarioKey) setScenarioKey(parsed.scenarioKey);

      toast.success(
        parsed.reasoning ||
          `Förslag baserat på "${aiPrompt}" — granska innan du sparar`,
        { duration: 6000 }
      );
    } catch (err) {
      // Fallback: enkel keyword-matchning
      const matches = searchScenarios(aiPrompt, 1);
      if (matches.length > 0) {
        applyScenario(matches[0]);
        toast.warning(
          "AI-tjänsten kunde inte nås — använde enkel matchning istället. Granska noggrant."
        );
      } else {
        toast.error(
          err instanceof Error
            ? err.message
            : "Kunde inte tolka texten. Fyll i fälten manuellt."
        );
      }
    } finally {
      setAiLoading(false);
    }
  }

  // Live-beräkning av moms
  const amountNum = Number(amountSek) || 0;
  const vatRateNum = Number(vatRate) || 0;
  const isReverse =
    eventType === "purchase_eu" ||
    eventType === "purchase_non_eu" ||
    eventType === "reverse_charge";
  const computedVat = Math.round(amountNum * vatRateNum);
  const outgoingVat =
    eventType === "sales" || isReverse ? computedVat : 0;
  const incomingVat =
    eventType === "purchase_se" || isReverse ? computedVat : 0;
  const netImpact = outgoingVat - incomingVat;

  async function handleSubmit() {
    if (!description.trim()) {
      toast.error("Beskrivning saknas");
      return;
    }
    if (amountNum <= 0) {
      toast.error("Ange ett belopp");
      return;
    }

    const payload = {
      eventDate,
      description: description.trim(),
      supplier: supplier.trim() || null,
      amountSek: amountNum,
      vatRate: vatRateNum,
      outgoingVat,
      incomingVat,
      eventType,
      basAccount: basAccount || null,
      scenarioKey: scenarioKey || null,
      notes: notes.trim() || null,
    };

    try {
      if (isEditMode && initialValue) {
        await update.mutateAsync({ id: initialValue.id, ...payload });
        toast.success("Moms-händelse uppdaterad");
      } else {
        await create.mutateAsync(payload);
      }
      onSuccess?.();
    } catch {
      toast.error("Kunde inte spara");
    }
  }

  const selectedScenario = scenarioKey ? getScenarioByKey(scenarioKey) : null;

  return (
    <div className="space-y-4">
      {/* AI-fritext-fält */}
      <div className="rounded-md border bg-primary/5 p-3 space-y-2">
        <Label className="text-xs flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          🤖 Beskriv i fritext — låt AI fylla i åt dig
        </Label>
        <div className="flex gap-2">
          <Input
            placeholder='t.ex. "Loopia webbhotell 2764,25 inkl moms" eller "Cursor 200 kr"'
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAiSuggest();
              }
            }}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={handleAiSuggest}
            disabled={!aiPrompt.trim() || aiLoading}
          >
            {aiLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Föreslå"
            )}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          AI:n matchar mot kunskapsbasen och föreslår konton + moms-flöde. Granska alltid innan du sparar.
        </p>
      </div>

      {/* Scenario-sökning */}
      <div className="space-y-2">
        <Label className="text-xs flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5" />
          Eller välj scenario manuellt
        </Label>
        <Input
          placeholder="Sök t.ex. 'mobil', 'ai usa', 'konsult tysk'..."
          value={scenarioSearch}
          onChange={(e) => setScenarioSearch(e.target.value)}
        />
        {matchingScenarios.length > 0 && (
          <div className="space-y-1">
            {matchingScenarios.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => applyScenario(s)}
                className="w-full text-left rounded-md border p-2 hover:bg-muted/50 transition-colors"
              >
                <p className="text-sm font-medium">{s.title}</p>
                <p className="text-xs text-muted-foreground">
                  {s.shortDescription}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedScenario && (
        <div className="rounded-md border bg-blue-500/5 border-blue-500/30 p-3 text-xs space-y-1">
          <p className="font-medium">📚 {selectedScenario.title}</p>
          <p className="text-muted-foreground whitespace-pre-line">
            {selectedScenario.flow}
          </p>
        </div>
      )}

      {/* Grundfält */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Datum *</Label>
          <Input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Belopp (SEK, exkl moms) *</Label>
          <Input
            type="number"
            placeholder="0"
            value={amountSek}
            onChange={(e) => setAmountSek(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Beskrivning *</Label>
        <Input
          placeholder="t.ex. Cursor-prenumeration"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Leverantör/kund (valfritt)</Label>
        <Input
          placeholder="t.ex. Anysphere Inc."
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Typ av händelse *</Label>
          <Select
            value={eventType}
            onValueChange={(v) => setEventType(v as VatEventType)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {eventTypeOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Moms-sats *</Label>
          <Select value={vatRate} onValueChange={setVatRate}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0.25">25 %</SelectItem>
              <SelectItem value="0.12">12 %</SelectItem>
              <SelectItem value="0.06">6 %</SelectItem>
              <SelectItem value="0">0 % (momsfri)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">BAS-konto (valfritt)</Label>
        <Select value={basAccount} onValueChange={setBasAccount}>
          <SelectTrigger>
            <SelectValue placeholder="Välj konto..." />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {ALL_BAS_KEYS.map((k) => (
              <SelectItem key={k} value={k}>
                {k} — {BAS_ACCOUNTS[k].name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Anteckningar (valfritt)</Label>
        <Textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Egna anteckningar..."
        />
      </div>

      {/* Live-saldo */}
      {amountNum > 0 && (
        <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
          <p className="font-medium mb-1">Beräkning:</p>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Belopp exkl moms</span>
            <span>{formatCurrency(amountNum)}</span>
          </div>
          {outgoingVat > 0 && (
            <div className="flex justify-between text-amber-700">
              <span>+ Utgående moms</span>
              <span>+{formatCurrency(outgoingVat)}</span>
            </div>
          )}
          {incomingVat > 0 && (
            <div className="flex justify-between text-green-700">
              <span>- Ingående moms</span>
              <span>-{formatCurrency(incomingVat)}</span>
            </div>
          )}
          <div className="flex justify-between font-medium pt-1 border-t">
            <span>Netto till SKV</span>
            <span className={netImpact > 0 ? "text-amber-700" : "text-green-700"}>
              {netImpact === 0 ? "0 (omvänd)" : formatCurrency(netImpact)}
            </span>
          </div>
        </div>
      )}

      {/* Knappar */}
      <div className="flex gap-2 justify-end pt-2">
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Avbryt
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={create.isPending || update.isPending}
        >
          {(create.isPending || update.isPending) && (
            <Loader2 className="w-4 h-4 animate-spin mr-1" />
          )}
          Spara
        </Button>
      </div>
    </div>
  );
}
