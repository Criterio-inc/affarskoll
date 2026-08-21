"use client";

import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Search,
  BookOpen,
  Globe,
  ShoppingCart,
  Receipt,
  Users,
  Building,
  Plane,
  Banknote,
} from "lucide-react";
import {
  VAT_SCENARIOS,
  CATEGORY_LABELS,
  searchScenarios,
  type VatCategory,
  type VatScenario,
} from "@/data/vat-scenarios";
import { formatCurrency } from "@/lib/utils";

const categoryIcons: Record<VatCategory, React.ComponentType<{ className?: string }>> = {
  purchase_se: ShoppingCart,
  purchase_eu: Globe,
  purchase_non_eu: Globe,
  purchase_no_vat: Receipt,
  sales: Receipt,
  personnel: Users,
  premises: Building,
  travel: Plane,
  finance: Banknote,
};

type CategoryFilter = "alla" | VatCategory;

export default function KunskapPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("alla");

  const filtered = useMemo(() => {
    let list: VatScenario[] = VAT_SCENARIOS;
    if (search.trim()) {
      list = searchScenarios(search, 50);
    }
    if (category !== "alla") {
      list = list.filter((s) => s.category === category);
    }
    return list;
  }, [search, category]);

  return (
    <div className="space-y-4">
      {/* Sök + filter */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Sök t.ex. 'AI USA', 'mobil', 'konsult tysk', 'taxi'..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Tabs
          value={category}
          onValueChange={(v) => setCategory(v as CategoryFilter)}
        >
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="alla">Alla</TabsTrigger>
            <TabsTrigger value="purchase_se">Inköp Sverige</TabsTrigger>
            <TabsTrigger value="purchase_eu">Inköp EU</TabsTrigger>
            <TabsTrigger value="purchase_non_eu">Inköp utanför EU</TabsTrigger>
            <TabsTrigger value="sales">Försäljning</TabsTrigger>
            <TabsTrigger value="travel">Resor</TabsTrigger>
            <TabsTrigger value="finance">Bank</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Resultat */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <BookOpen className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
            Inga scenarier matchar sökningen.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((s) => (
            <ScenarioCard key={s.key} scenario={s} />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center pt-4">
        💡 Saknar du ett scenario? Säg till så lägger vi till fler. AI-assistenten (Cmd+J) känner till alla dessa.
      </p>
    </div>
  );
}

function ScenarioCard({ scenario }: { scenario: VatScenario }) {
  const Icon = categoryIcons[scenario.category];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="rounded-md bg-primary/10 p-2 mt-0.5">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base">{scenario.title}</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {CATEGORY_LABELS[scenario.category]}
                {scenario.reverseCharge && (
                  <Badge variant="outline" className="ml-2 text-[10px]">
                    omvänd skattskyldighet
                  </Badge>
                )}
                <Badge variant="outline" className="ml-2 text-[10px]">
                  {Math.round(scenario.vatRate * 100)} % moms
                </Badge>
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>{scenario.shortDescription}</p>

        {/* Konton */}
        <div className="grid sm:grid-cols-2 gap-3 text-xs">
          {scenario.expenseAccount && (
            <div className="rounded-md border bg-muted/30 p-2">
              <p className="text-muted-foreground mb-1">Kostnadskonto</p>
              <p className="font-mono font-medium">
                {scenario.expenseAccount.number} {scenario.expenseAccount.name}
              </p>
            </div>
          )}
          {scenario.vatAccounts.length > 0 && (
            <div className="rounded-md border bg-muted/30 p-2">
              <p className="text-muted-foreground mb-1">Momskonton</p>
              <ul className="space-y-0.5">
                {scenario.vatAccounts.map((a) => (
                  <li key={a.number} className="font-mono">
                    {a.number} {a.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Flöde */}
        <div className="rounded-md border p-2 text-xs">
          <p className="text-muted-foreground mb-1 font-medium">Steg-för-steg:</p>
          <p className="whitespace-pre-line text-foreground">{scenario.flow}</p>
        </div>

        {/* Exempel */}
        <div className="rounded-md border bg-blue-500/5 border-blue-500/20 p-2 text-xs">
          <p className="text-muted-foreground mb-1 font-medium">Exempel:</p>
          <p className="whitespace-pre-line">{scenario.example}</p>
        </div>

        {/* Dooer-instruktioner */}
        {scenario.dooerInstructions && (
          <div className="rounded-md border bg-green-500/5 border-green-500/20 p-2 text-xs">
            <p className="text-muted-foreground mb-1 font-medium">💡 I Dooer:</p>
            <p>{scenario.dooerInstructions}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
