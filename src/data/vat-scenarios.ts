// Kunskapsbas för moms- och bokföringshantering
// Anpassad för svenska enmanskonsulter som använder Dooer (förenklad BAS-kontoplan)

export type VatCategory =
  | "purchase_se"        // Inköp Sverige
  | "purchase_eu"        // Inköp EU
  | "purchase_non_eu"    // Inköp utanför EU
  | "purchase_no_vat"    // Momsfritt inköp
  | "sales"              // Försäljning
  | "personnel"          // Personalkostnader
  | "premises"           // Lokal & teknik
  | "travel"             // Resor & representation
  | "finance";           // Ränta, bank, försäkring

export interface BasAccount {
  number: string;        // T.ex. "6540"
  name: string;          // T.ex. "IT-tjänster"
  description?: string;
}

export interface VatScenario {
  key: string;
  title: string;
  category: VatCategory;
  keywords: string[];    // för sökning
  // Bokföringsinstruktioner
  expenseAccount?: BasAccount;
  vatAccounts: BasAccount[];
  vatRate: number;       // 0, 0.06, 0.12, 0.25
  reverseCharge: boolean;
  // Användarvänlig förklaring
  shortDescription: string;
  flow: string;          // Steg-för-steg
  example: string;       // Konkret exempel
  dooerInstructions?: string; // Specifik vägledning för Dooer
}

// ============================================================================
// BAS-KONTON (förenklad lista, anpassad för Dooer)
// ============================================================================

export const BAS_ACCOUNTS = {
  // Intäktskonton (3xxx)
  "3001": { number: "3001", name: "Försäljning tjänster Sverige 25 % moms" },
  "3002": { number: "3002", name: "Försäljning tjänster Sverige 12 % moms" },
  "3003": { number: "3003", name: "Försäljning tjänster Sverige 6 % moms" },
  "3004": { number: "3004", name: "Försäljning momsfri Sverige" },
  "3005": { number: "3005", name: "Försäljning omvänd skattskyldighet" },
  "3105": { number: "3105", name: "Försäljning tjänster utanför EU (export)" },
  "3106": { number: "3106", name: "Försäljning tjänster EU-land (omvänd)" },
  "3690": { number: "3690", name: "Övriga sidointäkter" },

  // Momskonton (2xxx)
  "2611": { number: "2611", name: "Utgående moms 25 %" },
  "2612": { number: "2612", name: "Utgående moms 12 %" },
  "2613": { number: "2613", name: "Utgående moms 6 %" },
  "2614": { number: "2614", name: "Utgående moms omvänd skattskyldighet" },
  "2615": { number: "2615", name: "Utgående moms inköp utland (fiktiv)" },
  "2640": { number: "2640", name: "Ingående moms (inköp Sverige)" },
  "2641": { number: "2641", name: "Ingående moms (inköp utland med omvänd skatt)" },
  "2645": { number: "2645", name: "Beräknad ingående moms inköp utland" },
  "2650": { number: "2650", name: "Redovisningskonto för moms (skuldkonto SKV)" },

  // Inköpskonton för utländska tjänster (4xxx)
  "4515": { number: "4515", name: "Inköp tjänster från EU 25 % (omvänd)" },
  "4525": { number: "4525", name: "Inköp tjänster från EU 12 % (omvänd)" },
  "4531": { number: "4531", name: "Inköp tjänster från icke-EU-land 25 % (omvänd)" },
  "4535": { number: "4535", name: "Inköp tjänster från EU (huvudregel)" },

  // Driftskostnader (5xxx-6xxx)
  "5010": { number: "5010", name: "Lokalhyra" },
  "5410": { number: "5410", name: "Förbrukningsinventarier" },
  "5420": { number: "5420", name: "Programvaror & licenser" },
  "5460": { number: "5460", name: "Förbrukningsmaterial" },
  "5611": { number: "5611", name: "Drivmedel personbil" },
  "5800": { number: "5800", name: "Resekostnader" },
  "5810": { number: "5810", name: "Bilersättning (egen bil i tjänst)" },
  "6071": { number: "6071", name: "Representation, avdragsgill (max 60 kr/person)" },
  "6090": { number: "6090", name: "Övriga försäljningsomkostnader" },
  "6212": { number: "6212", name: "Mobiltelefon" },
  "6230": { number: "6230", name: "Datakommunikation, internet" },
  "6420": { number: "6420", name: "Revisionsarvoden" },
  "6530": { number: "6530", name: "Redovisningstjänster" },
  "6540": { number: "6540", name: "IT-tjänster" },
  "6550": { number: "6550", name: "Konsulttjänster (extern)" },
  "6570": { number: "6570", name: "Bankkostnader" },
  "6800": { number: "6800", name: "Inhyrd personal" },

  // Personalkostnader (7xxx)
  "7210": { number: "7210", name: "Lön till tjänstemän" },
  "7290": { number: "7290", name: "Övriga löner" },
  "7511": { number: "7511", name: "Arbetsgivaravgifter (lagstadgade)" },
  "7610": { number: "7610", name: "Utbildning" },
  "7621": { number: "7621", name: "Sjuk- och hälsovård (avdragsgill)" },
  "7630": { number: "7630", name: "Personalrepresentation" },
  "7690": { number: "7690", name: "Övriga personalkostnader" },
} as const satisfies Record<string, BasAccount>;

// ============================================================================
// SCENARIER (vanliga utgifts- och inkomsttyper)
// ============================================================================

export const VAT_SCENARIOS: VatScenario[] = [
  // ==========================================================================
  // Inköp Sverige
  // ==========================================================================
  {
    key: "phone-bill-se",
    title: "Mobilräkning från svensk operatör",
    category: "purchase_se",
    keywords: ["mobil", "telia", "tele2", "telefon", "abonnemang", "comviq"],
    expenseAccount: BAS_ACCOUNTS["6212"],
    vatAccounts: [BAS_ACCOUNTS["2640"]],
    vatRate: 0.25,
    reverseCharge: false,
    shortDescription: "Vanlig svensk mobilräkning med 25 % moms.",
    flow:
      "1) Belopp inkl moms står på fakturan\n" +
      "2) Konto 6212 Mobiltelefon (kostnad exkl moms)\n" +
      "3) Konto 2640 Ingående moms (25 % av nettot)\n" +
      "4) Du får tillbaka momsen vid årsdeklarationen",
    example:
      "Telia-räkning 625 kr inkl moms\n" +
      "→ 500 kr på 6212 (kostnad)\n" +
      "→ 125 kr på 2640 (moms du får tillbaka)",
    dooerInstructions: "Använd mall 'IT-tjänster' eller 'Telefon' i Dooer.",
  },
  {
    key: "internet-se",
    title: "Internet/bredband från svensk leverantör",
    category: "purchase_se",
    keywords: ["bredband", "fiber", "internet", "wifi", "router"],
    expenseAccount: BAS_ACCOUNTS["6230"],
    vatAccounts: [BAS_ACCOUNTS["2640"]],
    vatRate: 0.25,
    reverseCharge: false,
    shortDescription: "Internet i kontoret eller hemmakontoret.",
    flow:
      "1) Belopp inkl moms\n" +
      "2) Konto 6230 Datakommunikation\n" +
      "3) Konto 2640 Ingående moms 25 %",
    example: "Bahnhof 449 kr/mån inkl moms → 359 kr på 6230 + 90 kr på 2640",
  },
  {
    key: "office-rent-se",
    title: "Lokalhyra (kontor)",
    category: "purchase_se",
    keywords: ["hyra", "lokal", "kontor", "office", "coworking", "epicenter"],
    expenseAccount: BAS_ACCOUNTS["5010"],
    vatAccounts: [BAS_ACCOUNTS["2640"]],
    vatRate: 0.25,
    reverseCharge: false,
    shortDescription: "Hyra för kontorslokal eller coworking-plats. OBS: bara om hyresvärden är frivilligt momsregistrerad — annars momsfritt.",
    flow:
      "1) Är fakturan med moms?\n" +
      "   - Ja: konto 5010 + 2640 (25 %)\n" +
      "   - Nej (momsfritt): bara 5010, ingen moms-händelse\n" +
      "2) Hyra för bostad är ALLTID momsfri",
    example:
      "Coworking 2 500 kr inkl moms → 2 000 kr på 5010 + 500 kr på 2640",
  },
  {
    key: "office-supplies-se",
    title: "Förbrukningsmaterial / kontorsmaterial",
    category: "purchase_se",
    keywords: ["pennor", "papper", "skrivare", "bläck", "office", "post-it"],
    expenseAccount: BAS_ACCOUNTS["5460"],
    vatAccounts: [BAS_ACCOUNTS["2640"]],
    vatRate: 0.25,
    reverseCharge: false,
    shortDescription: "Vanligt kontorsmaterial.",
    flow:
      "1) Belopp inkl moms\n2) Konto 5460 + 2640",
    example: "Inköp Clas Ohlson 250 kr → 200 + 50 moms",
  },
  {
    key: "se-software-license",
    title: "Programvara / licens från svenskt företag",
    category: "purchase_se",
    keywords: ["programvara", "licens", "software", "saas svensk"],
    expenseAccount: BAS_ACCOUNTS["5420"],
    vatAccounts: [BAS_ACCOUNTS["2640"]],
    vatRate: 0.25,
    reverseCharge: false,
    shortDescription: "SaaS eller programvarulicens från svenskt företag (sällsynt — de flesta är från USA/EU).",
    flow: "1) Konto 5420 + 2640 (25 %)",
    example: "Lime CRM 990 kr/mån → 792 + 198 moms",
  },
  {
    key: "se-bank-fee",
    title: "Bankavgifter / kortavgifter",
    category: "finance",
    keywords: ["bank", "swedbank", "seb", "nordea", "kontoavgift", "bankkort"],
    expenseAccount: BAS_ACCOUNTS["6570"],
    vatAccounts: [],
    vatRate: 0,
    reverseCharge: false,
    shortDescription: "Bankavgifter är momsfria.",
    flow: "1) Konto 6570 Bankkostnader\n2) Ingen moms",
    example: "SEB månadsavgift 95 kr → 95 kr på 6570, ingen moms-händelse",
  },

  // ==========================================================================
  // Inköp EU (omvänd skattskyldighet)
  // ==========================================================================
  {
    key: "microsoft-365-eu",
    title: "Microsoft 365 (Irland, EU)",
    category: "purchase_eu",
    keywords: ["microsoft", "office 365", "azure", "outlook", "teams"],
    expenseAccount: BAS_ACCOUNTS["5420"],
    vatAccounts: [BAS_ACCOUNTS["4535"], BAS_ACCOUNTS["2614"], BAS_ACCOUNTS["2645"]],
    vatRate: 0.25,
    reverseCharge: true,
    shortDescription: "Microsoft fakturerar från Irland. Omvänd skattskyldighet — du redovisar moms både utgående och ingående (netto 0 till SKV).",
    flow:
      "1) Belopp utan moms (Microsoft tar inte moms)\n" +
      "2) Räkna ut fiktiv moms 25 %\n" +
      "3) Konto 5420 Programvara (kostnad)\n" +
      "4) Konto 2614 Utgående moms omvänd (+ moms-belopp)\n" +
      "5) Konto 2645 Beräknad ingående moms (- samma belopp)\n" +
      "6) Nettoeffekt på Skatteverket: 0 kr",
    example:
      "Microsoft 365 Business 130 kr/mån utan moms\n" +
      "→ 130 kr på 5420 (kostnad)\n" +
      "→ +33 kr utgående / -33 kr ingående (netto 0)",
    dooerInstructions: "Välj 'Inköp tjänst EU' i Dooer (mall finns).",
  },
  {
    key: "stripe-fees",
    title: "Stripe / payment-fees (Irland, EU)",
    category: "purchase_eu",
    keywords: ["stripe", "betalningsavgifter", "payment", "paypal eu"],
    expenseAccount: BAS_ACCOUNTS["6570"],
    vatAccounts: [BAS_ACCOUNTS["4535"], BAS_ACCOUNTS["2614"], BAS_ACCOUNTS["2645"]],
    vatRate: 0.25,
    reverseCharge: true,
    shortDescription: "Stripe/PayPal-avgifter från Irland.",
    flow: "Samma som Microsoft 365 — omvänd skattskyldighet, netto 0",
    example: "Stripe-avgifter 350 kr → 350 + 88 omvänd moms (netto 0)",
  },
  {
    key: "consultant-eu",
    title: "Konsultarvode från EU-firma (t.ex. Tyskland, Danmark)",
    category: "purchase_eu",
    keywords: ["konsult", "tysk", "dansk", "underleverantör", "EU"],
    expenseAccount: BAS_ACCOUNTS["6550"],
    vatAccounts: [BAS_ACCOUNTS["4535"], BAS_ACCOUNTS["2614"], BAS_ACCOUNTS["2645"]],
    vatRate: 0.25,
    reverseCharge: true,
    shortDescription: "Inköp av konsulttjänst från EU. Omvänd skattskyldighet.",
    flow:
      "1) Verifiera att leverantören har VAT-nummer\n" +
      "2) Belopp utan moms från leverantören\n" +
      "3) Konto 6550 + omvänd skattskyldighet 25 %",
    example:
      "Tysk konsult 2 500 EUR ≈ 28 500 kr\n" +
      "→ 28 500 kr på 6550\n" +
      "→ +7 125 utgående / -7 125 ingående (netto 0)",
  },
  {
    key: "linkedin-eu",
    title: "LinkedIn-prenumeration (Irland, EU)",
    category: "purchase_eu",
    keywords: ["linkedin", "premium", "sales navigator"],
    expenseAccount: BAS_ACCOUNTS["5420"],
    vatAccounts: [BAS_ACCOUNTS["4535"], BAS_ACCOUNTS["2614"], BAS_ACCOUNTS["2645"]],
    vatRate: 0.25,
    reverseCharge: true,
    shortDescription: "LinkedIn fakturerar från Irland. Omvänd skattskyldighet.",
    flow: "Samma som Microsoft 365 — netto 0 på moms",
    example: "LinkedIn Premium 549 kr/mån → 549 + 137 omvänd moms (netto 0)",
  },

  // ==========================================================================
  // Inköp utanför EU (omvänd skattskyldighet)
  // ==========================================================================
  {
    key: "ai-service-usa",
    title: "AI-tjänst från USA (Cursor, Claude API, ChatGPT, etc.)",
    category: "purchase_non_eu",
    keywords: ["ai", "cursor", "claude", "chatgpt", "openai", "anthropic", "perplexity", "usa"],
    expenseAccount: BAS_ACCOUNTS["6540"],
    vatAccounts: [BAS_ACCOUNTS["4531"], BAS_ACCOUNTS["2614"], BAS_ACCOUNTS["2645"]],
    vatRate: 0.25,
    reverseCharge: true,
    shortDescription: "AI-tjänster från USA är utanför EU. Omvänd skattskyldighet — du beräknar och redovisar moms själv (netto 0 till SKV).",
    flow:
      "1) Du betalar t.ex. 19 USD ≈ 200 kr (ingen moms från leverantören)\n" +
      "2) Räkna ut fiktiv moms 25 %: 200 × 25 % = 50 kr\n" +
      "3) Konto 6540 IT-tjänster: 200 kr (kostnad)\n" +
      "4) Konto 2614 Utgående omvänd: +50 kr\n" +
      "5) Konto 2645 Ingående omvänd: -50 kr\n" +
      "6) Nettoeffekt SKV: 0 kr",
    example:
      "Cursor Pro 19 USD ≈ 200 kr\n" +
      "→ 200 kr på 6540 (kostnad)\n" +
      "→ +50 utgående / -50 ingående (netto 0)",
    dooerInstructions: "Välj 'Inköp tjänst icke-EU' i Dooer.",
  },
  {
    key: "adobe-cloud-usa",
    title: "Adobe Creative Cloud (USA)",
    category: "purchase_non_eu",
    keywords: ["adobe", "photoshop", "illustrator", "creative cloud"],
    expenseAccount: BAS_ACCOUNTS["5420"],
    vatAccounts: [BAS_ACCOUNTS["4531"], BAS_ACCOUNTS["2614"], BAS_ACCOUNTS["2645"]],
    vatRate: 0.25,
    reverseCharge: true,
    shortDescription: "Adobe fakturerar oftast från USA — kontrollera fakturan! Omvänd skattskyldighet om från USA.",
    flow: "Samma som AI-tjänst USA",
    example: "Adobe Photography 119 kr/mån utan moms → 119 + 30 omvänd (netto 0)",
  },
  {
    key: "zoom-usa",
    title: "Zoom (USA)",
    category: "purchase_non_eu",
    keywords: ["zoom", "videomöte", "video", "möte"],
    expenseAccount: BAS_ACCOUNTS["6540"],
    vatAccounts: [BAS_ACCOUNTS["4531"], BAS_ACCOUNTS["2614"], BAS_ACCOUNTS["2645"]],
    vatRate: 0.25,
    reverseCharge: true,
    shortDescription: "Zoom Pro fakturerar från USA.",
    flow: "Samma som AI-tjänst USA",
    example: "Zoom Pro 159 kr/mån utan moms → 159 + 40 omvänd (netto 0)",
  },
  {
    key: "notion-usa",
    title: "Notion (USA)",
    category: "purchase_non_eu",
    keywords: ["notion", "anteckningar", "wiki"],
    expenseAccount: BAS_ACCOUNTS["5420"],
    vatAccounts: [BAS_ACCOUNTS["4531"], BAS_ACCOUNTS["2614"], BAS_ACCOUNTS["2645"]],
    vatRate: 0.25,
    reverseCharge: true,
    shortDescription: "Notion fakturerar från USA.",
    flow: "Samma som AI-tjänst USA",
    example: "Notion Pro 10 USD/mån ≈ 105 kr → 105 + 26 omvänd (netto 0)",
  },

  // ==========================================================================
  // Resor & representation
  // ==========================================================================
  {
    key: "train-se",
    title: "Tåg / SJ-resor",
    category: "travel",
    keywords: ["sj", "tåg", "biljett", "resa"],
    expenseAccount: BAS_ACCOUNTS["5800"],
    vatAccounts: [BAS_ACCOUNTS["2640"]],
    vatRate: 0.06,
    reverseCharge: false,
    shortDescription: "Persontransport i Sverige har 6 % moms.",
    flow:
      "1) Belopp inkl 6 % moms\n" +
      "2) Konto 5800 Resekostnader\n" +
      "3) Konto 2640 Ingående moms 6 %",
    example: "SJ Stockholm-Göteborg 530 kr inkl 6 % → 500 kr på 5800 + 30 kr moms",
  },
  {
    key: "taxi-se",
    title: "Taxi i Sverige",
    category: "travel",
    keywords: ["taxi", "uber", "bolt", "cab"],
    expenseAccount: BAS_ACCOUNTS["5800"],
    vatAccounts: [BAS_ACCOUNTS["2640"]],
    vatRate: 0.06,
    reverseCharge: false,
    shortDescription: "Taxi i Sverige har 6 % moms.",
    flow: "Konto 5800 + 2640 med 6 %",
    example: "Taxi 318 kr inkl 6 % → 300 kr på 5800 + 18 kr moms",
  },
  {
    key: "representation-meal",
    title: "Affärsmöte med mat (extern representation)",
    category: "travel",
    keywords: ["lunch", "middag", "representation", "möte", "kund"],
    expenseAccount: BAS_ACCOUNTS["6071"],
    vatAccounts: [BAS_ACCOUNTS["2640"]],
    vatRate: 0.12,
    reverseCharge: false,
    shortDescription: "Avdragsgill representation: max 60 kr/person/tillfälle (exkl moms). Moms 12 % på mat.",
    flow:
      "1) Räkna antal personer × 60 kr som avdragsgillt belopp\n" +
      "2) Konto 6071 (avdragsgill del) + ingående moms 12 % på den delen\n" +
      "3) Resten är icke-avdragsgill → bokförs separat (Dooer hanterar detta)",
    example:
      "Lunch 2 personer 800 kr inkl moms\n" +
      "→ Avdragsgillt: 60 × 2 = 120 kr (12 % moms = 14 kr)\n" +
      "→ Resten 666 kr är icke-avdragsgill",
  },

  // ==========================================================================
  // Försäljning (intäkter)
  // ==========================================================================
  {
    key: "consulting-se",
    title: "Konsultarvode till svensk kund",
    category: "sales",
    keywords: ["faktura", "konsult", "uppdrag", "tjänst", "sverige"],
    expenseAccount: BAS_ACCOUNTS["3001"],
    vatAccounts: [BAS_ACCOUNTS["2611"]],
    vatRate: 0.25,
    reverseCharge: false,
    shortDescription: "Vanligt konsultarvode till svenskt företag — 25 % moms.",
    flow:
      "1) Du fakturerar netto + 25 % moms\n" +
      "2) Konto 3001 Försäljning tjänster Sverige\n" +
      "3) Konto 2611 Utgående moms 25 %\n" +
      "4) Vid kontantmetoden: räknas när kunden betalar",
    example:
      "100 timmar à 1 200 kr = 120 000 kr + 30 000 moms = 150 000 kr inkl",
  },
  {
    key: "consulting-eu-customer",
    title: "Konsultuppdrag till kund inom EU (omvänd)",
    category: "sales",
    keywords: ["fakturera EU", "tysk kund", "dansk kund"],
    expenseAccount: BAS_ACCOUNTS["3106"],
    vatAccounts: [],
    vatRate: 0,
    reverseCharge: true,
    shortDescription: "Konsulttjänst till EU-företag med VAT-nummer: omvänd skattskyldighet — du fakturerar utan moms.",
    flow:
      "1) Verifiera kundens VAT-nummer (vies.europa.eu)\n" +
      "2) Fakturera utan moms\n" +
      "3) Konto 3106 — ingen moms-händelse\n" +
      "4) Ange 'Reverse charge' på fakturan",
    example: "Faktura till tyskt företag: 50 000 kr utan moms",
  },
  {
    key: "consulting-non-eu-customer",
    title: "Konsultuppdrag till kund utanför EU (export)",
    category: "sales",
    keywords: ["export", "USA-kund", "norge", "schweiz"],
    expenseAccount: BAS_ACCOUNTS["3105"],
    vatAccounts: [],
    vatRate: 0,
    reverseCharge: false,
    shortDescription: "Tjänst till företag utanför EU — momsfri (export).",
    flow:
      "1) Fakturera utan moms\n" +
      "2) Konto 3105 Försäljning tjänster utanför EU",
    example: "Faktura till norsk kund: 50 000 NOK utan moms",
  },
];

// ============================================================================
// HJÄLPFUNKTIONER
// ============================================================================

/**
 * Sök i kunskapsbasen baserat på fri text.
 * Returnerar de mest relevanta scenarierna sorterade efter träffsäkerhet.
 */
export function searchScenarios(query: string, limit = 5): VatScenario[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const scored = VAT_SCENARIOS.map((s) => {
    let score = 0;
    if (s.title.toLowerCase().includes(q)) score += 10;
    if (s.shortDescription.toLowerCase().includes(q)) score += 3;
    for (const kw of s.keywords) {
      if (kw.toLowerCase() === q) score += 8;
      else if (q.includes(kw.toLowerCase())) score += 5;
      else if (kw.toLowerCase().includes(q)) score += 2;
    }
    return { scenario: s, score };
  });

  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.scenario);
}

export function getScenarioByKey(key: string): VatScenario | undefined {
  return VAT_SCENARIOS.find((s) => s.key === key);
}

export function getScenariosByCategory(
  category: VatCategory
): VatScenario[] {
  return VAT_SCENARIOS.filter((s) => s.category === category);
}

export const CATEGORY_LABELS: Record<VatCategory, string> = {
  purchase_se: "Inköp Sverige",
  purchase_eu: "Inköp EU",
  purchase_non_eu: "Inköp utanför EU",
  purchase_no_vat: "Momsfritt inköp",
  sales: "Försäljning",
  personnel: "Personalkostnader",
  premises: "Lokal & teknik",
  travel: "Resor & representation",
  finance: "Bank & finans",
};
