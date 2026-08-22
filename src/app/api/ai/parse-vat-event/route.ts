// AI-parser för moms-händelser
// Tar fri text och returnerar strukturerad data: konto, typ, belopp, moms-flöde.
// Bygger på Claude API med kunskapsbasen som kontext.

import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { VAT_SCENARIOS, BAS_ACCOUNTS } from "@/data/vat-scenarios";

export const maxDuration = 30;

// Schema för output
const ParsedVatEvent = z.object({
  eventDate: z
    .string()
    .describe("Datum (YYYY-MM-DD). Om användaren inte anger något, lämna tom sträng så client använder dagens datum."),
  description: z.string().describe("Kort beskrivning av händelsen, t.ex. 'Loopia webbhotell'"),
  supplier: z
    .string()
    .nullable()
    .describe("Leverantörens/kundens namn om det går att utläsa, annars null"),
  amountSek: z
    .number()
    .describe(
      "Beloppet i SEK EXKL moms. Om användaren skriver 'inklusive moms' eller 'inkl moms', räkna ner med moms-satsen (brutto / (1 + vatRate)). Annars använd det angivna beloppet."
    ),
  vatRate: z
    .number()
    .describe("Moms-sats som decimal: 0, 0.06, 0.12 eller 0.25"),
  eventType: z
    .enum([
      "sales",
      "purchase_se",
      "purchase_eu",
      "purchase_non_eu",
      "reverse_charge",
      "other",
    ])
    .describe(
      "Vilken typ av händelse: sales=försäljning du gjort, purchase_se=inköp från svensk leverantör med vanlig moms, purchase_eu=inköp från EU-leverantör (omvänd skatt, t.ex. Microsoft Irland), purchase_non_eu=inköp utanför EU (omvänd skatt, t.ex. AI-tjänst USA), reverse_charge=annan omvänd skattskyldighet, other=övrigt"
    ),
  basAccount: z
    .string()
    .nullable()
    .describe(
      "BAS-konto-nummer (t.ex. '6540', '5420', '3001'). Använd matchande konto från kunskapsbasen. Null om osäker."
    ),
  scenarioKey: z
    .string()
    .nullable()
    .describe("Nyckel från matchande scenario i kunskapsbasen, eller null"),
  reasoning: z
    .string()
    .describe(
      "Kort förklaring (1-2 meningar) på varför du valde dessa värden — så användaren kan granska."
    ),
});

export async function POST(req: Request) {
  // AI är ett tillval — utan nyckel svarar vi tydligt i stället för SDK-krasch
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: "AI-funktionen är inte aktiverad (ANTHROPIC_API_KEY saknas)" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { text } = await req.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "text krävs i body" },
        { status: 400 }
      );
    }

    // Bygg kompakt kontext av kunskapsbasen — bara titel + keywords + nyckel-info per scenario
    const scenariosContext = VAT_SCENARIOS.map((s) => ({
      key: s.key,
      title: s.title,
      category: s.category,
      keywords: s.keywords,
      vatRate: s.vatRate,
      reverseCharge: s.reverseCharge,
      expenseAccount: s.expenseAccount?.number,
      shortDescription: s.shortDescription,
    }));

    // Lista av vanliga BAS-konton för kostnadssidan
    const commonAccounts = Object.entries(BAS_ACCOUNTS)
      .filter(([num]) => num.startsWith("5") || num.startsWith("6") || num.startsWith("3"))
      .map(([num, acc]) => `${num} ${acc.name}`)
      .join("\n");

    const today = new Date().toISOString().slice(0, 10);

    const systemPrompt = `Du är en bokföringsassistent för svenska konsulter som använder Affärskoll.

Du tar fri text om en moms-relaterad händelse (utgift eller intäkt) och returnerar strukturerad data.

KRITISKA REGLER:
1. **Beloppet ska alltid returneras EXKL moms.** Om användaren skriver "inklusive moms", "inkl moms", "med moms" — räkna ned till nettobeloppet. Formel: netto = brutto / (1 + vatRate). Avrunda till 2 decimaler. Om användaren inte säger något om "inkl/exkl" är default att det är EXKL moms.

2. **Identifiera ursprung korrekt:**
   - Svenska leverantörer (Loopia, Telia, Tele2, Bahnhof, Bredbandsbolaget, COOP, ICA, OKQ8, Lime, Fortnox, Visma, etc.) → purchase_se, normal ingående moms
   - EU-leverantörer (Microsoft, LinkedIn, Stripe, Spotify Business, etc. — ofta fakturerade från Irland) → purchase_eu, omvänd skatt
   - USA/icke-EU (Cursor, ChatGPT/Anthropic, Adobe, Notion, Zoom, Slack, Figma, GitHub, Google Workspace) → purchase_non_eu, omvänd skatt
   - Försäljning ("fakturerat", "kunden betalade", "intäkt") → sales

3. **Vanliga moms-satser:**
   - 25% är default i Sverige
   - 12% för mat, hotell, taxi, tåg
   - 6% för persontransport, kultur
   - 0% för bankavgifter, försäkring, vissa hyror

4. **Datum:** Idag är ${today}. Om användaren skriver "idag", "imorse" → använd ${today}. Annars försök tolka datum från texten. Om inget datum nämns, lämna eventDate tom så client använder dagens.

5. **Beloppet ska vara ett number, inte sträng.** Använd punkt som decimaltecken i din parsning. "2764,25" och "2764.25" är båda 2764.25.

KUNSKAPSBAS (matcha scenarioKey om det finns en bra match):
${JSON.stringify(scenariosContext, null, 0)}

VANLIGA BAS-KONTON FÖR KOSTNADER OCH FÖRSÄLJNING:
${commonAccounts}

EXEMPEL:

Input: "Loopia webbhotell. 2764,25 kr inklusive moms"
Output: { eventDate: "", description: "Loopia webbhotell", supplier: "Loopia", amountSek: 2211.40, vatRate: 0.25, eventType: "purchase_se", basAccount: "6230", scenarioKey: null, reasoning: "Loopia är svenskt webbhotell, normal svensk moms 25%. 2764.25 inkl → 2211.40 exkl moms." }

Input: "Cursor pro 200 kr 15 maj"
Output: { eventDate: "2026-05-15", description: "Cursor pro", supplier: "Anysphere", amountSek: 200, vatRate: 0.25, eventType: "purchase_non_eu", basAccount: "6540", scenarioKey: "ai-service-usa", reasoning: "Cursor är AI-tjänst från USA. Omvänd skatt — du betalar 200 kr utan moms från säljaren, fiktiv moms räknas på det." }

Input: "Telia 590 kr inkl moms"
Output: { eventDate: "", description: "Telia mobilräkning", supplier: "Telia", amountSek: 472, vatRate: 0.25, eventType: "purchase_se", basAccount: "6212", scenarioKey: "phone-bill-se", reasoning: "Telia är svensk operatör, 25% moms. 590 inkl → 472 exkl moms." }`;

    const result = await generateObject({
      model: anthropic("claude-sonnet-4-5-20250929"),
      schema: ParsedVatEvent,
      system: systemPrompt,
      prompt: `Tolka och strukturera följande moms-händelse:\n\n"${text}"`,
    });

    return NextResponse.json(result.object);
  } catch (error) {
    console.error("[AI VAT Parse Error]", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internt fel",
      },
      { status: 500 }
    );
  }
}
