import { anthropic } from "@ai-sdk/anthropic";
import { streamText, tool, stepCountIs, convertToModelMessages } from "ai";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import {
  projects,
  calculatorPortfolios,
  timeEntries,
  userSettings,
  vatEvents,
  invoicePackages,
} from "@/lib/db/schema";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import {
  searchScenarios,
  getScenarioByKey,
  VAT_SCENARIOS,
} from "@/data/vat-scenarios";
import {
  calculateHoursFromAllocation,
  calculateBreakEvenThreshold,
  calculateMonthlyForecast,
  calculatePortfolioSummary,
  getSafeSettings,
} from "@/lib/calculator-engine";
import { AppSettings } from "@/lib/settings";
import type { PortfolioAssignment } from "@/types/portfolio";

export const maxDuration = 30;

const SYSTEM_PROMPT = `Du är en AI-assistent inbyggd i Affärskoll, en konsulthanteringsapp för svenska frilansare och konsulter.

Du hjälper användaren att:
- Skapa nya uppdrag/projekt
- Lägga till uppdrag i portföljen
- Logga arbetstid
- Svara på frågor om portfölj, uppdrag, beläggning och ekonomi
- Beräkna timpris, break-even, lönsamhet och prognoser baserat på användarens egna kostnader och inställningar

VIKTIGT - Data finns i appen:
- Du har tillgång till användarens ALLA inställningar: lön, arbetsgivaravgifter, overhead, förmedlingsavgifter, semesterinställningar etc.
- Du har tillgång till portföljens uppdrag med timmar, timpris och faser.
- Använd ALLTID getPortfolioSummary-verktyget för att hämta komplett data INNAN du svarar på frågor om ekonomi, timpris, lönsamhet eller prognoser.
- Fråga INTE användaren efter information som redan finns i systemet (kostnader, lön, timmar etc.).

Regler:
- Svara alltid på svenska
- Var kortfattad och tydlig
- Vid skapande: Om kritisk information saknas (titel, kund, datum, timmar), fråga efter det innan du skapar. Men gissa rimliga defaults där det går (status=aktiv, kategori=ovrigt, etc.)
- Datum-format: YYYY-MM-DD
- Kontraktstyper: "timpris" (timbaserat), "fastpris" (fast pris), "blandat" (mix), "fastpris_overtid" (fast + övertid per timme)
- Status: "prospekt", "aktiv", "avslutad", "arkiverad"
- Kategorier för tid: "planering", "dokumentation", "mote", "resa", "analys", "utbildning_forelasning", "ej_debiterbar", "ovrigt"

VIKTIGT - Faser och omfattning:
- När användaren nämner olika omfattning/beläggning under olika perioder (t.ex. "heltid mars-sept, halvtid okt-dec"), ANVÄND ALLTID faser (phases) med allocationPercentage.
- Heltid = 100%, halvtid = 50%, 80% = 80%, etc.
- Timmar beräknas automatiskt från arbetsdagar (mån-fre) × 8h × procent.
- Skicka ALLTID faser när användaren anger perioder med olika omfattning. Sätt INTE bara totala timmar med jämn fördelning.
- Även om användaren bara har EN period men anger omfattning (t.ex. "halvtid hela året"), använd en fas med rätt procent.

När du skapar ett uppdrag OCH användaren vill ha det i portföljen, skapa projektet FÖRST och lägg sedan till det i portföljen med projektets ID.

Bekräfta alltid vad du skapat med en kort sammanfattning.

EKONOMI-MODUL (Fakturor + Momslogg):
- Fakturor GENERERAS numera i appen (Ekonomi → Fakturor → Ny faktura): löpnummer sätts automatiskt (730, 731 ...), rader byggs från tidsposterna, PDF med tidrapportbilaga laddas ner från fakturasidan. Äldre fakturor kan sakna löpnummer och i stället ha ett externt fakturanummer (externalInvoiceNumber) från ett tidigare bokföringsflöde.
- Vid frågor om utgifter, moms, BAS-konton — använd ALLTID lookupVatScenario FÖRST för att hitta rätt konto och momsbehandling.
- Vid moms-händelser där användaren beskriver i fritext: använd lookupVatScenario, sedan createVatEvent.
- Användaren kör KONTANTMETODEN och har KVARTALSMOMS sedan 2026 — momsen redovisas vid betalningsdatum (eller fakturans momsdatum om satt), inte fakturadatum.
- Belopp ska alltid anges i SEK. Om användaren nämner USD/EUR — be hen om SEK-beloppet (det som faktiskt drogs på kortet).
- Vid omvänd skattskyldighet (EU/icke-EU): nettoeffekten på Skatteverket är 0, men händelsen ska ändå loggas.
- BAS-konton:
  - 3001 = Försäljning Sverige 25 % moms (default för konsultarvoden)
  - 6540 = IT-tjänster (för AI-tjänster, SaaS från USA/EU)
  - 5420 = Programvaror & licenser
  - 6230 = Datakommunikation (mobil, internet)
  - 6212 = Mobiltelefon
  - 4531 = Inköp tjänster icke-EU (omvänd)
  - 4535 = Inköp tjänster EU (omvänd)
  - 2614 = Utgående moms omvänd (fiktiv)
  - 2645 = Beräknad ingående moms inköp utland`;

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { messages } = await req.json();

    // Fetch current data for context
    const [userProjects, userPortfolio, userSettingsResult] = await Promise.all([
      db
        .select()
        .from(projects)
        .where(eq(projects.userId, userId))
        .orderBy(desc(projects.createdAt)),
      db
        .select()
        .from(calculatorPortfolios)
        .where(eq(calculatorPortfolios.userId, userId)),
      db
        .select()
        .from(userSettings)
        .where(eq(userSettings.userId, userId)),
    ]);

  const portfolioAssignments =
    (userPortfolio[0]?.assignments as PortfolioAssignment[] | undefined) ?? [];
  const settings = getSafeSettings(userSettingsResult[0]?.settings as Partial<AppSettings> | null);

  const activeProjects = userProjects.filter((p) => p.status === "aktiv");

  // Calculate financial metrics
  const monthlyCosts = settings.monthlySalaryGross * (1 + settings.employerTaxRate) + settings.monthlyOverhead + settings.brokerMonthlyFee;
  const breakEven = calculateBreakEvenThreshold(settings);

  const contextMessage = `
Aktuell data:
- ${userProjects.length} projekt (${activeProjects.length} aktiva)
- ${portfolioAssignments.length} uppdrag i portföljen

Användarens ekonomiska inställningar:
- Bruttolön: ${settings.monthlySalaryGross} SEK/mån
- Arbetsgivaravgifter: ${(settings.employerTaxRate * 100).toFixed(1)}%
- Lönekostnad (brutto + AG-avgift): ${Math.round(settings.monthlySalaryGross * (1 + settings.employerTaxRate))} SEK/mån
- Overhead: ${settings.monthlyOverhead} SEK/mån
- Förmedlingsavgift: ${settings.brokerMonthlyFee} SEK/mån (provision ${(settings.brokerCommissionRate * 100).toFixed(0)}%)
- Totala månadskostnader: ${Math.round(monthlyCosts)} SEK
- Break-even per månad: ${Math.round(breakEven)} SEK
- Målbart timmar/år: ${settings.targetBillableHoursPerYear}h
- Semester: ${settings.vacationWeeks} veckor (${settings.vacationMonths.join(", ")})

Aktiva projekt: ${
    activeProjects
      .map(
        (p) =>
          `"${p.title}" (kund: ${p.customerName}, ${p.contractType}, ${p.budgetedHours}h, ${p.hourlyRate ? p.hourlyRate + ' SEK/h' : ''}, ${p.startDate}–${p.endDate})`
      )
      .join("; ") || "inga"
  }

Portföljuppdrag: ${
    portfolioAssignments
      .map(
        (a: any) =>
          `"${a.name}" (${a.customerName}, ${a.contractType}, ${a.hours}h, ${a.hourlyRate ? a.hourlyRate + ' SEK/h' : ''}, ${a.startDate}–${a.endDate})`
      )
      .join("; ") || "inga"
  }

Dagens datum: ${new Date().toISOString().split("T")[0]}`;

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: anthropic("claude-sonnet-4-5-20250929"),
    system: SYSTEM_PROMPT + "\n\n" + contextMessage,
    messages: modelMessages,
    tools: {
      createProject: tool({
        description:
          "Skapa ett nytt projekt/uppdrag i systemet. Använd detta när användaren vill registrera ett nytt uppdrag. VIKTIGT: Använd phases med allocationPercentage när uppdraget har olika omfattning under olika perioder.",
        inputSchema: z.object({
          title: z.string().describe("Uppdragets titel/namn"),
          customerName: z.string().describe("Kundnamn"),
          startDate: z.string().describe("Startdatum (YYYY-MM-DD)"),
          endDate: z.string().describe("Slutdatum (YYYY-MM-DD)"),
          contractType: z
            .enum(["timpris", "fastpris", "blandat", "fastpris_overtid"])
            .describe("Kontraktstyp"),
          hourlyRate: z
            .number()
            .optional()
            .describe("Timpris i SEK (för timpris/blandat)"),
          fixedPrice: z
            .number()
            .optional()
            .describe("Fast pris i SEK (för fastpris/blandat)"),
          budgetedHours: z
            .number()
            .optional()
            .describe("Budgeterade timmar totalt (ignoreras om phases anges, beräknas då automatiskt)"),
          status: z
            .enum(["prospekt", "aktiv", "avslutad", "arkiverad"])
            .optional()
            .describe("Projektets status (default: aktiv)"),
          notes: z.string().optional().describe("Eventuella anteckningar"),
          plannedHoursPerWeek: z
            .number()
            .optional()
            .describe("Planerade timmar per vecka"),
          phases: z
            .array(
              z.object({
                name: z.string().describe("Fasens namn, t.ex. 'Fas 1'"),
                startDate: z.string().describe("Fasens startdatum (YYYY-MM-DD)"),
                endDate: z.string().describe("Fasens slutdatum (YYYY-MM-DD)"),
                allocationPercentage: z
                  .number()
                  .describe("Omfattning i procent: 100 = heltid, 50 = halvtid"),
              })
            )
            .optional()
            .describe("Faser med olika omfattning. Timmar beräknas automatiskt från arbetsdagar × 8h × procent."),
        }),
        execute: async (params) => {
          try {
            // Build phases with auto-calculated hours
            let projectPhases: any[] = [];
            let totalHours = params.budgetedHours ?? 0;

            if (params.phases && params.phases.length > 0) {
              projectPhases = params.phases.map((p) => {
                const hours = calculateHoursFromAllocation(
                  p.startDate,
                  p.endDate,
                  p.allocationPercentage
                );
                return {
                  id: crypto.randomUUID(),
                  name: p.name,
                  startDate: p.startDate,
                  endDate: p.endDate,
                  allocationPercentage: p.allocationPercentage,
                  hours,
                };
              });
              totalHours = projectPhases.reduce(
                (sum: number, p: any) => sum + p.hours,
                0
              );
            }

            const [created] = await db
              .insert(projects)
              .values({
                userId,
                customerName: params.customerName,
                title: params.title,
                startDate: params.startDate,
                endDate: params.endDate,
                budgetedHours: String(totalHours),
                contractType: params.contractType,
                hourlyRate: params.hourlyRate
                  ? String(params.hourlyRate)
                  : null,
                fixedPrice: params.fixedPrice
                  ? String(params.fixedPrice)
                  : null,
                status: params.status ?? "aktiv",
                pipelineStatus: "förhandling",
                workPackages: [],
                phases: projectPhases.length > 0 ? projectPhases : [],
                usePhaseDistribution: projectPhases.length > 0,
                plannedHoursPerWeek: params.plannedHoursPerWeek
                  ? String(params.plannedHoursPerWeek)
                  : null,
                notes: params.notes ?? null,
              })
              .returning();

            return {
              success: true,
              project: {
                id: created.id,
                title: created.title,
                customerName: created.customerName,
                contractType: created.contractType,
                startDate: created.startDate,
                endDate: created.endDate,
                budgetedHours: totalHours,
                phases: projectPhases.length > 0
                  ? projectPhases.map((p: any) => ({
                      name: p.name,
                      period: `${p.startDate} – ${p.endDate}`,
                      allocationPercentage: p.allocationPercentage,
                      hours: p.hours,
                    }))
                  : undefined,
              },
            };
          } catch (err: any) {
            return { success: false, error: err.message ?? "Okänt fel" };
          }
        },
      }),

      addToPortfolio: tool({
        description:
          "Lägg till ett uppdrag i portföljen för prognoser och ekonomisk planering. VIKTIGT: När användaren anger olika omfattning under olika perioder (t.ex. heltid mars-sept, halvtid okt-dec), använd ALLTID phases med allocationPercentage. Timmar beräknas automatiskt.",
        inputSchema: z.object({
          name: z.string().describe("Uppdragets namn"),
          customerName: z.string().optional().describe("Kundnamn"),
          startDate: z.string().describe("Startdatum (YYYY-MM-DD)"),
          endDate: z.string().describe("Slutdatum (YYYY-MM-DD)"),
          contractType: z
            .enum(["timpris", "fastpris", "blandat", "fastpris_overtid"])
            .describe("Kontraktstyp"),
          hourlyRate: z.number().optional().describe("Timpris i SEK"),
          fixedPrice: z.number().optional().describe("Fast pris i SEK"),
          hours: z.number().optional().describe("Totala timmar (ignoreras om phases anges, beräknas då automatiskt)"),
          phases: z
            .array(
              z.object({
                name: z.string().describe("Fasens namn, t.ex. 'Fas 1' eller 'Uppstart'"),
                startDate: z.string().describe("Fasens startdatum (YYYY-MM-DD)"),
                endDate: z.string().describe("Fasens slutdatum (YYYY-MM-DD)"),
                allocationPercentage: z
                  .number()
                  .describe("Omfattning i procent: 100 = heltid, 50 = halvtid"),
              })
            )
            .optional()
            .describe("Faser med olika omfattning. Använd detta när uppdraget har varierande beläggning."),
          projectId: z
            .string()
            .optional()
            .describe("ID för kopplat projekt (om det finns)"),
        }),
        execute: async (params) => {
          try {
            // Build phases with auto-calculated hours
            let assignmentPhases: any[] | undefined;
            let totalHours = params.hours ?? 0;
            let distributionMode: "even" | "phases" = "even";

            if (params.phases && params.phases.length > 0) {
              distributionMode = "phases";
              assignmentPhases = params.phases.map((p) => {
                const hours = calculateHoursFromAllocation(
                  p.startDate,
                  p.endDate,
                  p.allocationPercentage
                );
                return {
                  id: crypto.randomUUID(),
                  name: p.name,
                  startDate: p.startDate,
                  endDate: p.endDate,
                  allocationPercentage: p.allocationPercentage,
                  hours,
                };
              });
              totalHours = assignmentPhases.reduce(
                (sum: number, p: any) => sum + p.hours,
                0
              );
            }

            const newAssignment = {
              id: crypto.randomUUID(),
              name: params.name,
              customerName: params.customerName ?? "",
              startDate: params.startDate,
              endDate: params.endDate,
              contractType: params.contractType,
              hourlyRate: params.hourlyRate,
              fixedPrice: params.fixedPrice,
              hours: totalHours,
              isFromSystem: !!params.projectId,
              projectId: params.projectId,
              distributionMode,
              phases: assignmentPhases,
              revenueLagMonths: 1,
              skipAbsenceDeduction: false,
            };

            const updatedAssignments = [
              ...portfolioAssignments,
              newAssignment,
            ];

            const [existing] = await db
              .select()
              .from(calculatorPortfolios)
              .where(eq(calculatorPortfolios.userId, userId));

            if (existing) {
              await db
                .update(calculatorPortfolios)
                .set({
                  assignments: updatedAssignments,
                  updatedAt: new Date(),
                })
                .where(eq(calculatorPortfolios.userId, userId));
            } else {
              await db.insert(calculatorPortfolios).values({
                userId,
                assignments: updatedAssignments,
              });
            }

            return {
              success: true,
              assignment: {
                id: newAssignment.id,
                name: params.name,
                hours: totalHours,
                period: `${params.startDate} – ${params.endDate}`,
                distributionMode,
                phases: assignmentPhases?.map((p: any) => ({
                  name: p.name,
                  period: `${p.startDate} – ${p.endDate}`,
                  allocationPercentage: p.allocationPercentage,
                  hours: p.hours,
                })),
              },
              totalAssignments: updatedAssignments.length,
            };
          } catch (err: any) {
            return { success: false, error: err.message ?? "Okänt fel" };
          }
        },
      }),

      logTime: tool({
        description:
          "Registrera arbetstid för ett projekt.",
        inputSchema: z.object({
          projectTitle: z
            .string()
            .describe("Projektets titel (matchar mot befintliga projekt)"),
          date: z.string().describe("Datum (YYYY-MM-DD)"),
          hours: z.number().describe("Antal timmar"),
          category: z
            .enum([
              "planering",
              "dokumentation",
              "mote",
              "resa",
              "analys",
              "utbildning_forelasning",
              "ej_debiterbar",
              "ovrigt",
            ])
            .optional()
            .describe("Arbetskategori (default: ovrigt)"),
          description: z
            .string()
            .optional()
            .describe("Beskrivning av arbetet"),
        }),
        execute: async (params) => {
          // Find matching project (fuzzy)
          const searchTerm = params.projectTitle.toLowerCase();
          const match = userProjects.find(
            (p) =>
              p.title.toLowerCase().includes(searchTerm) ||
              searchTerm.includes(p.title.toLowerCase())
          );

          if (!match) {
            return {
              success: false,
              error: `Hittade inget projekt som matchar "${params.projectTitle}". Befintliga: ${userProjects.map((p) => `"${p.title}"`).join(", ") || "inga projekt"}`,
            };
          }

          try {
            const category = params.category ?? "ovrigt";
            const isBillable = category !== "ej_debiterbar";

            const [entry] = await db
              .insert(timeEntries)
              .values({
                userId,
                projectId: match.id,
                date: params.date,
                hours: String(params.hours),
                category,
                description:
                  params.description || "Tid registrerad via AI-assistent",
                isBillable,
              })
              .returning();

            return {
              success: true,
              entry: {
                project: match.title,
                date: params.date,
                hours: params.hours,
                category,
              },
            };
          } catch (err: any) {
            return { success: false, error: err.message ?? "Okänt fel" };
          }
        },
      }),

      getPortfolioSummary: tool({
        description:
          "Hämta en komplett sammanfattning av portföljen, ekonomiska inställningar, kostnader, prognoser och break-even. ANVÄND DETTA VERKTYG FÖR ALLA FRÅGOR om timpris, lönsamhet, kostnader, prognoser eller ekonomi. Data finns i systemet - fråga INTE användaren efter den.",
        inputSchema: z.object({
          question: z
            .string()
            .optional()
            .describe("Vad användaren frågar om"),
        }),
        execute: async () => {
          const totalHours = portfolioAssignments.reduce(
            (sum: number, a: any) => sum + (a.hours ?? 0),
            0
          );

          // Financial calculations
          const salaryCost = settings.monthlySalaryGross * (1 + settings.employerTaxRate);
          const overheadCost = settings.monthlyOverhead + settings.brokerMonthlyFee;
          const totalMonthlyCost = salaryCost + overheadCost;
          const breakEvenMonthly = calculateBreakEvenThreshold(settings);

          // Calculate break-even hourly rate
          const monthlyBillableHours = settings.targetBillableHoursPerYear / 12;
          const breakEvenHourlyRate = monthlyBillableHours > 0
            ? Math.ceil(breakEvenMonthly / monthlyBillableHours)
            : 0;

          // Total revenue from portfolio
          const totalRevenue = portfolioAssignments.reduce(
            (sum: number, a: any) => {
              if (a.contractType === "fastpris") return sum + (a.fixedPrice ?? 0);
              return sum + (a.hours ?? 0) * (a.hourlyRate ?? 0);
            },
            0
          );

          // Monthly forecast (next 12 months)
          let monthlyForecast: any[] = [];
          try {
            const forecastData = calculateMonthlyForecast({
              assignments: portfolioAssignments,
              settings,
            });
            monthlyForecast = forecastData.slice(0, 12).map((m: any) => ({
              month: m.month,
              revenue: m.revenue,
              costs: m.costs,
              net: m.net,
              cumulative: m.cumulative,
              workedHours: m.workedHours,
            }));
          } catch {
            // Forecast calculation may fail with invalid data, that's ok
          }

          return {
            // Portfölj & projekt
            totalProjects: userProjects.length,
            activeProjects: activeProjects.length,
            portfolioAssignments: portfolioAssignments.length,
            totalPortfolioHours: totalHours,
            totalPortfolioRevenue: Math.round(totalRevenue),

            // Kostnader
            costs: {
              monthlySalaryGross: settings.monthlySalaryGross,
              employerTaxRate: settings.employerTaxRate,
              salaryCostPerMonth: Math.round(salaryCost),
              monthlyOverhead: settings.monthlyOverhead,
              brokerMonthlyFee: settings.brokerMonthlyFee,
              brokerCommissionRate: settings.brokerCommissionRate,
              totalMonthlyCost: Math.round(totalMonthlyCost),
              breakEvenPerMonth: Math.round(breakEvenMonthly),
              breakEvenHourlyRate,
            },

            // Planering
            planning: {
              targetBillableHoursPerYear: settings.targetBillableHoursPerYear,
              targetWeeklyHours: settings.targetWeeklyHours,
              vacationWeeks: settings.vacationWeeks,
              vacationMonths: settings.vacationMonths,
              monthlyBillableHours: Math.round(monthlyBillableHours),
            },

            // Detaljerade uppdrag
            assignments: portfolioAssignments.map((a: any) => ({
              name: a.name,
              customer: a.customerName,
              period: `${a.startDate} – ${a.endDate}`,
              hours: a.hours,
              contractType: a.contractType,
              hourlyRate: a.hourlyRate,
              fixedPrice: a.fixedPrice,
              distributionMode: a.distributionMode,
              phases: a.phases?.map((p: any) => ({
                name: p.name,
                period: `${p.startDate} – ${p.endDate}`,
                allocationPercentage: p.allocationPercentage,
                hours: p.hours,
              })),
            })),

            // Aktiva projekt
            projects: activeProjects.map((p) => ({
              title: p.title,
              customer: p.customerName,
              status: p.status,
              budgetedHours: p.budgetedHours,
              contractType: p.contractType,
              hourlyRate: p.hourlyRate,
              period: `${p.startDate} – ${p.endDate}`,
            })),

            // Månadsprognos
            monthlyForecast,
          };
        },
      }),

      // ======================================================================
      // EKONOMI-VERKTYG
      // ======================================================================

      lookupVatScenario: tool({
        description:
          "Slår upp i kunskapsbasen för att hitta rätt BAS-konto, momsbehandling och bokföringsflöde för en utgift eller inkomst. Använd ALLTID detta först när användaren frågar om hur en utgift ska bokföras eller vilken moms som gäller. Returnerar matchande scenarier med konton, exempel och steg-för-steg-flöde.",
        inputSchema: z.object({
          query: z
            .string()
            .describe(
              "Sökord eller fri beskrivning av utgiften, t.ex. 'AI USA', 'Cursor', 'mobilräkning', 'konsult Tyskland'"
            ),
        }),
        execute: async (params) => {
          const matches = searchScenarios(params.query, 3);
          if (matches.length === 0) {
            return {
              found: false,
              message: `Hittade inget scenario för "${params.query}". Kunskapsbasen har ${VAT_SCENARIOS.length} scenarier — fråga om något annat eller fyll i manuellt.`,
            };
          }
          return {
            found: true,
            scenarios: matches.map((s) => ({
              key: s.key,
              title: s.title,
              category: s.category,
              vatRate: s.vatRate,
              reverseCharge: s.reverseCharge,
              expenseAccount: s.expenseAccount
                ? `${s.expenseAccount.number} ${s.expenseAccount.name}`
                : null,
              vatAccounts: s.vatAccounts.map(
                (a) => `${a.number} ${a.name}`
              ),
              shortDescription: s.shortDescription,
              flow: s.flow,
              example: s.example,
            })),
          };
        },
      }),

      createVatEvent: tool({
        description:
          "Skapa en moms-händelse i appens momslogg. Använd EFTER lookupVatScenario så du har rätt konto och momsbehandling. Vid omvänd skattskyldighet (EU/icke-EU): sätt eventType till 'purchase_eu' eller 'purchase_non_eu' så räknar systemet automatiskt utgående och ingående moms (netto 0).",
        inputSchema: z.object({
          eventDate: z
            .string()
            .describe("Datum för händelsen (YYYY-MM-DD), oftast betalningsdatum"),
          description: z
            .string()
            .describe("Kort beskrivning, t.ex. 'Cursor AI-prenumeration'"),
          supplier: z.string().optional().describe("Leverantör/kund"),
          amountSek: z
            .number()
            .describe(
              "Belopp i SEK exkl moms. Användaren ska ALLTID ange SEK-belopp (det som drogs från kortet) — be om det om hen anger USD/EUR."
            ),
          vatRate: z
            .number()
            .describe("Moms-sats som decimal: 0, 0.06, 0.12, eller 0.25"),
          eventType: z
            .enum([
              "sales",
              "purchase_se",
              "purchase_eu",
              "purchase_non_eu",
              "reverse_charge",
              "other",
            ])
            .describe("Typ av händelse"),
          basAccount: z
            .string()
            .optional()
            .describe(
              "BAS-konto, t.ex. '6540' för IT-tjänster eller '3001' för försäljning"
            ),
          scenarioKey: z
            .string()
            .optional()
            .describe(
              "Nyckel från lookupVatScenario om händelsen matchar ett scenario"
            ),
          notes: z.string().optional().describe("Anteckningar"),
        }),
        execute: async (params) => {
          try {
            const amount = params.amountSek;
            const rate = params.vatRate;
            const computed = amount * rate;

            let outgoingVat = 0;
            let incomingVat = 0;
            switch (params.eventType) {
              case "sales":
                outgoingVat = computed;
                break;
              case "purchase_se":
                incomingVat = computed;
                break;
              case "purchase_eu":
              case "purchase_non_eu":
              case "reverse_charge":
                outgoingVat = computed;
                incomingVat = computed;
                break;
            }

            const [created] = await db
              .insert(vatEvents)
              .values({
                userId,
                eventDate: params.eventDate,
                description: params.description,
                supplier: params.supplier ?? null,
                amountSek: String(amount),
                vatRate: String(rate),
                outgoingVat: String(outgoingVat),
                incomingVat: String(incomingVat),
                eventType: params.eventType,
                basAccount: params.basAccount ?? null,
                scenarioKey: params.scenarioKey ?? null,
                notes: params.notes ?? null,
              })
              .returning();

            return {
              success: true,
              event: {
                id: created.id,
                date: params.eventDate,
                description: params.description,
                amountSek: amount,
                outgoingVat: Math.round(outgoingVat),
                incomingVat: Math.round(incomingVat),
                netToSkv: Math.round(outgoingVat - incomingVat),
                basAccount: params.basAccount,
              },
            };
          } catch (err: unknown) {
            const message =
              err instanceof Error ? err.message : "Okänt fel";
            return { success: false, error: message };
          }
        },
      }),

      getVatSummary: tool({
        description:
          "Hämta moms-saldo för ett visst beskattningsår — utgående moms, ingående moms, och netto att betala till Skatteverket. Använd för frågor som 'hur mycket moms ska jag betala?'.",
        inputSchema: z.object({
          year: z
            .number()
            .optional()
            .describe(
              "Beskattningsår, default = innevarande år"
            ),
        }),
        execute: async (params) => {
          const year = params.year ?? new Date().getFullYear();
          const events = await db
            .select()
            .from(vatEvents)
            .where(
              and(
                eq(vatEvents.userId, userId),
                gte(vatEvents.eventDate, `${year}-01-01`),
                lte(vatEvents.eventDate, `${year}-12-31`)
              )
            );

          let totalOutgoing = 0;
          let totalIncoming = 0;
          for (const e of events) {
            totalOutgoing += Number(e.outgoingVat ?? 0);
            totalIncoming += Number(e.incomingVat ?? 0);
          }
          const netToPay = totalOutgoing - totalIncoming;

          return {
            year,
            eventCount: events.length,
            totalOutgoingVat: Math.round(totalOutgoing),
            totalIncomingVat: Math.round(totalIncoming),
            netToPay: Math.round(netToPay),
            interpretation:
              netToPay > 0
                ? `Du ska betala ${Math.round(netToPay)} kr till Skatteverket för ${year}. Eftersom du är aktiebolag med kalenderår, årsmoms och utan EU-handel: deklareras "i anslutning till inkomstdeklarationen" — senast omkring 1-17 augusti ${year + 1}.`
                : netToPay < 0
                ? `Du har ${Math.abs(Math.round(netToPay))} kr att återfå från Skatteverket för ${year}`
                : `Momsen tar ut sig själv för ${year} (oftast omvänd skattskyldighet på inköp)`,
          };
        },
      }),

      getInvoicePackagesSummary: tool({
        description:
          "Hämta sammanfattning av faktureringspaket — hur många skickade, hur mycket obetalt, etc.",
        inputSchema: z.object({
          status: z
            .enum(["alla", "utkast", "skickad", "betald"])
            .optional()
            .describe("Filtrera på status"),
        }),
        execute: async (params) => {
          const allPackages = await db
            .select()
            .from(invoicePackages)
            .where(eq(invoicePackages.userId, userId));

          const filtered =
            params.status && params.status !== "alla"
              ? allPackages.filter((p) => p.status === params.status)
              : allPackages;

          const totalAmount = filtered.reduce(
            (sum, p) => sum + Number(p.totalInclVat ?? 0),
            0
          );

          const draftCount = allPackages.filter((p) => p.status === "utkast").length;
          const sentCount = allPackages.filter((p) => p.status === "skickad").length;
          const paidCount = allPackages.filter((p) => p.status === "betald").length;
          const sentTotal = allPackages
            .filter((p) => p.status === "skickad")
            .reduce((s, p) => s + Number(p.totalInclVat ?? 0), 0);

          return {
            count: filtered.length,
            totalAmountInclVat: Math.round(totalAmount),
            statusBreakdown: {
              utkast: draftCount,
              skickade: sentCount,
              betalda: paidCount,
            },
            unpaidTotal: Math.round(sentTotal),
            recentPackages: filtered.slice(0, 5).map((p) => ({
              id: p.id,
              project: p.projectTitle,
              customer: p.customerName,
              amount: Math.round(Number(p.totalInclVat ?? 0)),
              status: p.status,
              invoiceNumber: p.invoiceNumber,          // appgenererad faktura (730, 731 ...)
              buyer: p.buyerName,                       // fakturamottagare (t.ex. förmedlingspartnern)
              generatedInApp: p.invoiceNumber != null,
              externalInvoiceNumber: p.externalInvoiceNumber, // fakturerad utanför appen
              periodStart: p.periodStart,
              periodEnd: p.periodEnd,
            })),
          };
        },
      }),
    },
    stopWhen: stepCountIs(4),
  });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("[AI Chat Error]", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internt fel" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
