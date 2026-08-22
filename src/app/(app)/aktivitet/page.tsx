"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import {
  Activity,
  CalendarDays,
  Flame,
  Medal,
  Tag,
  Target,
  Timer,
  TrendingUp,
} from "lucide-react";
import { useTimeEntries } from "@/hooks/use-time-entries";
import { WORK_CATEGORY_LABELS, type WorkCategory } from "@/types/project";

// Timmar utan onödig decimal: 8 → "8", 7,5 → "7,5" (samma mönster som tidsrapporteringen)
const fmtHours = (h: number): string =>
  Number.isInteger(h)
    ? String(h)
    : h.toLocaleString("sv-SE", { maximumFractionDigits: 1 });

type Period = "all" | "30d" | "7d";

const PERIOD_LABELS: Record<Period, string> = {
  all: "Allt",
  "30d": "30 dagar",
  "7d": "7 dagar",
};

// Lokalt datum som YYYY-MM-DD — toISOString skiftar en dag i svensk tidszon.
const isoLocal = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

const addDays = (d: Date, n: number): Date => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

const isWeekend = (d: Date): boolean => d.getDay() === 0 || d.getDay() === 6;

// Föregående vardag — sviten är en vardagssvit, helger varken räknas eller bryter.
const prevWorkday = (d: Date): Date => {
  let r = addDays(d, -1);
  while (isWeekend(r)) r = addDays(r, -1);
  return r;
};

// Intensitetsnivåer för heatmapen. Literala klasser så Tailwind ser dem.
const LEVEL_CLASSES = [
  "bg-secondary",
  "bg-primary/25",
  "bg-primary/45",
  "bg-primary/70",
  "bg-primary",
];
const levelFor = (h: number): number =>
  h <= 0 ? 0 : h < 2 ? 1 : h < 4 ? 2 : h < 6 ? 3 : 4;

// Sagan om ringen-trilogin, extended edition, är 11,4 timmar lång.
const LOTR_HOURS = 11.4;

export default function AktivitetPage() {
  const { data: timeEntries = [], isLoading } = useTimeEntries();
  const [period, setPeriod] = useState<Period>("all");

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const todayIso = isoLocal(today);

  // Bara utfört arbete: planerade framtida poster räknas inte.
  const pastEntries = useMemo(
    () => timeEntries.filter((e) => e.date <= todayIso && Number(e.hours) > 0),
    [timeEntries, todayIso]
  );

  const periodStartIso = useMemo(() => {
    if (period === "7d") return isoLocal(addDays(today, -6));
    if (period === "30d") return isoLocal(addDays(today, -29));
    return "";
  }, [period, today]);

  const entries = useMemo(
    () => pastEntries.filter((e) => e.date >= periodStartIso),
    [pastEntries, periodStartIso]
  );

  const stats = useMemo(() => {
    let total = 0;
    let billable = 0;
    const byDate = new Map<string, number>();
    const byCategory = new Map<WorkCategory, number>();
    for (const e of entries) {
      const h = Number(e.hours);
      total += h;
      if (e.isBillable !== false) billable += h;
      byDate.set(e.date, (byDate.get(e.date) ?? 0) + h);
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + h);
    }
    let maxDay: { date: string; hours: number } | null = null;
    for (const [date, hours] of byDate) {
      if (!maxDay || hours > maxDay.hours) maxDay = { date, hours };
    }
    let topCategory: WorkCategory | null = null;
    let topCategoryHours = 0;
    for (const [cat, hours] of byCategory) {
      if (hours > topCategoryHours) {
        topCategory = cat;
        topCategoryHours = hours;
      }
    }
    return {
      total,
      billableShare: total > 0 ? billable / total : 0,
      activeDays: byDate.size,
      avgPerActiveDay: byDate.size > 0 ? total / byDate.size : 0,
      maxDay,
      topCategory,
      topCategoryHours,
    };
  }, [entries]);

  // Sviterna räknas alltid på hela historiken, oavsett vald period.
  const streaks = useMemo(() => {
    const active = new Set(pastEntries.map((e) => e.date));
    if (active.size === 0) return { current: 0, longest: 0 };

    let cursor = new Date(today);
    if (!active.has(isoLocal(cursor))) cursor = prevWorkday(cursor);
    let current = 0;
    while (active.has(isoLocal(cursor))) {
      current++;
      cursor = prevWorkday(cursor);
    }

    const first = [...active].sort()[0];
    let longest = 0;
    let run = 0;
    for (let d = new Date(`${first}T00:00:00`); d <= today; d = addDays(d, 1)) {
      if (isWeekend(d)) continue;
      if (active.has(isoLocal(d))) {
        run++;
        if (run > longest) longest = run;
      } else {
        run = 0;
      }
    }
    return { current, longest };
  }, [pastEntries, today]);

  // Heatmap: veckokolumner (mån–sön) fram till i dag.
  const heatmap = useMemo(() => {
    const weeks = period === "7d" ? 2 : period === "30d" ? 6 : 26;
    const hoursByDate = new Map<string, number>();
    for (const e of pastEntries) {
      hoursByDate.set(e.date, (hoursByDate.get(e.date) ?? 0) + Number(e.hours));
    }
    const thisMonday = addDays(today, -((today.getDay() + 6) % 7));
    const startMonday = addDays(thisMonday, -(weeks - 1) * 7);
    const columns = Array.from({ length: weeks }, (_, w) => {
      const monday = addDays(startMonday, w * 7);
      const days = Array.from({ length: 7 }, (_, i) => {
        const date = addDays(monday, i);
        return {
          date,
          iso: isoLocal(date),
          hours: hoursByDate.get(isoLocal(date)) ?? 0,
          future: date > today,
        };
      });
      const monthLabel =
        monday.getDate() <= 7
          ? monday.toLocaleDateString("sv-SE", { month: "short" })
          : "";
      return { monday, days, monthLabel };
    });
    return { columns };
  }, [pastEntries, period, today]);

  const totalAllTime = useMemo(
    () => pastEntries.reduce((s, e) => s + Number(e.hours), 0),
    [pastEntries]
  );
  const workWeeks = totalAllTime / 40;
  const lotrCount = Math.round(totalAllTime / LOTR_HOURS);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Aktivitet"
        description="Din loggade tid i siffror"
        actions={
          <div className="flex items-center gap-1">
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <Button
                key={p}
                size="sm"
                variant={period === p ? "default" : "outline"}
                onClick={() => setPeriod(p)}
              >
                {PERIOD_LABELS[p]}
              </Button>
            ))}
          </div>
        }
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Laddar aktivitet…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              title="Loggade timmar"
              value={`${fmtHours(stats.total)} h`}
              subtitle={period === "all" ? "totalt" : `senaste ${PERIOD_LABELS[period].toLowerCase()}`}
              icon={Timer}
              variant="primary"
            />
            <StatCard
              title="Debiterbar andel"
              value={`${Math.round(stats.billableShare * 100)} %`}
              subtitle="av loggad tid"
              icon={Target}
            />
            <StatCard
              title="Aktiva dagar"
              value={String(stats.activeDays)}
              subtitle="dagar med loggad tid"
              icon={CalendarDays}
            />
            <StatCard
              title="Snitt per aktiv dag"
              value={`${fmtHours(stats.avgPerActiveDay)} h`}
              icon={TrendingUp}
            />
            <StatCard
              title="Nuvarande svit"
              value={`${streaks.current} dgr`}
              subtitle="vardagar i rad, helg bryter inte"
              icon={Flame}
              variant={streaks.current >= 5 ? "accent" : "default"}
            />
            <StatCard
              title="Längsta svit"
              value={`${streaks.longest} dgr`}
              subtitle="vardagar i rad"
              icon={Medal}
            />
            <StatCard
              title="Största dagen"
              value={stats.maxDay ? `${fmtHours(stats.maxDay.hours)} h` : "–"}
              subtitle={
                stats.maxDay
                  ? new Date(`${stats.maxDay.date}T00:00:00`).toLocaleDateString(
                      "sv-SE",
                      { day: "numeric", month: "short", year: "numeric" }
                    )
                  : undefined
              }
              icon={Activity}
            />
            <StatCard
              title="Toppkategori"
              value={
                stats.topCategory
                  ? WORK_CATEGORY_LABELS[stats.topCategory]
                  : "–"
              }
              subtitle={
                stats.topCategory
                  ? `${fmtHours(stats.topCategoryHours)} h`
                  : undefined
              }
              icon={Tag}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Aktivitetskarta</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto pb-1">
                <div className="inline-flex flex-col gap-1">
                  <div className="flex gap-1 pl-8 text-[10px] text-muted-foreground">
                    {heatmap.columns.map((col, i) => (
                      <div key={i} className="w-3 shrink-0">
                        {col.monthLabel && (
                          <span className="block w-8">{col.monthLabel}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  {Array.from({ length: 7 }, (_, row) => (
                    <div key={row} className="flex items-center gap-1">
                      <span className="w-7 shrink-0 text-[10px] text-muted-foreground">
                        {row === 0 ? "mån" : row === 2 ? "ons" : row === 4 ? "fre" : ""}
                      </span>
                      {heatmap.columns.map((col, i) => {
                        const day = col.days[row];
                        if (day.future) {
                          return <div key={i} className="w-3 h-3 shrink-0" />;
                        }
                        return (
                          <div
                            key={i}
                            title={`${day.date.toLocaleDateString("sv-SE", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            })}: ${fmtHours(day.hours)} h`}
                            className={`w-3 h-3 shrink-0 rounded-[3px] ${
                              LEVEL_CLASSES[levelFor(day.hours)]
                            }`}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span>Mindre</span>
                {LEVEL_CLASSES.map((cls) => (
                  <div key={cls} className={`w-3 h-3 rounded-[3px] ${cls}`} />
                ))}
                <span>Mer</span>
              </div>
            </CardContent>
          </Card>

          {totalAllTime > 0 && (
            <p className="text-sm text-muted-foreground">
              Totalt {fmtHours(totalAllTime)} h loggade sedan starten — ungefär{" "}
              {workWeeks.toLocaleString("sv-SE", { maximumFractionDigits: 1 })}{" "}
              arbetsveckor
              {lotrCount >= 1 && (
                <>
                  , eller {lotrCount}{" "}
                  {lotrCount === 1 ? "genomtittning" : "genomtittningar"} av
                  Sagan om ringen-trilogin i extended edition
                </>
              )}
              .
            </p>
          )}
        </>
      )}
    </div>
  );
}
