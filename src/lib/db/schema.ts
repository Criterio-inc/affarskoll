import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  jsonb,
  date,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ============================================================================
// PROJECTS
// ============================================================================

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    customerId: uuid("customer_id"),
    customerName: text("customer_name").notNull(),
    title: text("title").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    budgetedHours: numeric("budgeted_hours").notNull(),
    contractType: text("contract_type").notNull(), // fastpris | timpris | blandat | fastpris_overtid
    hourlyRate: numeric("hourly_rate"),
    fixedPrice: numeric("fixed_price"),
    status: text("status").notNull().default("prospekt"), // prospekt | aktiv | avslutad | arkiverad
    pipelineStatus: text("pipeline_status").default("förfrågan"),
    workPackages: jsonb("work_packages").default([]),
    contractFiles: jsonb("contract_files").default([]),
    plannedHoursPerWeek: numeric("planned_hours_per_week"),
    billingDate: integer("billing_date"),
    notes: text("notes"),
    usePhaseDistribution: boolean("use_phase_distribution").default(false),
    phases: jsonb("phases").default([]),
    // Fas 4.1: revenueLagMonths per project (overrides settings.defaultRevenueLagMonths)
    revenueLagMonths: integer("revenue_lag_months"),
    // Fas 4.1: skipAbsenceDeduction for part-time/flexible assignments
    skipAbsenceDeduction: boolean("skip_absence_deduction").default(false),
    // Förmedlingspartnern tar normalt provision (settings.brokerCommissionRate). Sätt true
    // för uppdrag utan förmedlingsprovision — då dras ingen provision.
    brokerCommissionExempt: boolean("broker_commission_exempt").default(false),
    // Arbetsställe/tjänsteställe för uppdraget (SKV-bedömning per uppdrag).
    // distans = hemmet är tjänsteställe; blandat = ~% på plats; pa_plats =
    // kundens plats är tjänsteställe (resor dit = arbetsresor, ingen ersättning).
    workplaceType: text("workplace_type").default("distans"),
    workplaceSharePct: integer("workplace_share_pct"),
    workplaceNote: text("workplace_note"),
    // D14: Soft delete — om satt så är projektet 'raderat' men kan återställas
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_projects_user_status").on(table.userId, table.status),
    index("idx_projects_user_customer").on(table.userId, table.customerId),
  ]
);

// ============================================================================
// TIME ENTRIES
// ============================================================================

export const timeEntries = pgTable(
  "time_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    workPackageId: text("work_package_id"),
    phaseId: text("phase_id"),
    date: date("date").notNull(),
    hours: numeric("hours").notNull(),
    category: text("category").notNull(),
    description: text("description").default(""),
    isBillable: boolean("is_billable").default(true),
    // Arbetsställe för dagen: hemma | hos_kund | annan (för tjänsteställe-underlag)
    location: text("location"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_time_entries_user_date").on(table.userId, table.date),
    index("idx_time_entries_project").on(table.projectId),
  ]
);

// ============================================================================
// CUSTOMERS
// ============================================================================

export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  contactPerson: text("contact_person"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  notes: text("notes"),
  defaultHourlyRate: numeric("default_hourly_rate"),
  // Fakturauppgifter — behövs när kunden är köpare på en genererad faktura
  orgNumber: text("org_number"),
  invoiceStreet: text("invoice_street"),
  invoicePostalCode: text("invoice_postal_code"),
  invoiceCity: text("invoice_city"),
  invoiceCountry: text("invoice_country"),
  invoiceReference: text("invoice_reference"),   // "Er referens"
  deliveryAddress: text("delivery_address"),     // flerradig; tom = samma som fakturaadress
  paymentTermsDays: integer("payment_terms_days"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================================================
// CUSTOMER COMMUNICATIONS
// ============================================================================

export const customerCommunications = pgTable("customer_communications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  type: text("type").notNull(), // email | telefon | möte | övrigt
  summary: text("summary").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================================================
// USER SETTINGS
// ============================================================================

export const userSettings = pgTable("user_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().unique(),
  settings: jsonb("settings").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================================
// SAVED CALCULATIONS
// ============================================================================

export const savedCalculations = pgTable("saved_calculations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  projectId: uuid("project_id"),
  projectName: text("project_name"),
  contractType: text("contract_type").notNull(),
  fixedPrice: numeric("fixed_price").default("0"),
  hours: numeric("hours").default("0"),
  hourlyRate: numeric("hourly_rate").default("0"),
  actualHours: numeric("actual_hours"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  grossRevenue: numeric("gross_revenue").default("0"),
  netRevenue: numeric("net_revenue").default("0"),
  netProfit: numeric("net_profit").default("0"),
  profitMargin: numeric("profit_margin").default("0"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================================
// CALCULATOR PORTFOLIOS
// ============================================================================

export const calculatorPortfolios = pgTable("calculator_portfolios", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().unique(),
  assignments: jsonb("assignments").default([]),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================================
// NOTIFICATIONS (NEW)
// ============================================================================

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    type: text("type").notNull(), // budget_warning | contract_expiry | billing_reminder | weekly_summary
    title: text("title").notNull(),
    message: text("message"),
    projectId: uuid("project_id"),
    read: boolean("read").default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_notifications_user_read").on(table.userId, table.read),
  ]
);

// ============================================================================
// PROJECT TEMPLATES (NEW)
// ============================================================================

export const projectTemplates = pgTable("project_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  templateData: jsonb("template_data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================================================
// TIMESHEET TEMPLATES (NEW)
// ============================================================================

export const timesheetTemplates = pgTable("timesheet_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  entries: jsonb("entries").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================================================
// INVOICE PACKAGES (Fakturor — appgenererade med löpnummer sedan aug 2026;
// äldre poster har enbart ett externt fakturanummer)
// ============================================================================

export const invoicePackages = pgTable(
  "invoice_packages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    customerId: uuid("customer_id"),
    customerName: text("customer_name").notNull(),
    projectId: uuid("project_id"),
    projectTitle: text("project_title"),
    // Period som fakturan täcker (kan skilja sig från betalningsdatum vid kontantmetoden)
    periodStart: date("period_start"),
    periodEnd: date("period_end"),
    // Belopp
    theoreticalAmount: numeric("theoretical_amount").default("0"), // timmar × pris
    actualAmount: numeric("actual_amount").notNull(),               // det som verkligen fakturerades
    adjustmentReason: text("adjustment_reason"),                    // varför actual ≠ theoretical
    // Moms
    vatRate: numeric("vat_rate").default("0.25"),                    // 0.25 / 0.12 / 0.06 / 0
    vatAmount: numeric("vat_amount").default("0"),
    totalInclVat: numeric("total_incl_vat").default("0"),
    // Bokföring
    basAccount: text("bas_account").default("3001"),                 // BAS-konto för intäkten
    // Status
    status: text("status").notNull().default("utkast"),              // utkast | skickad | betald | krediterad
    issueDate: date("issue_date"),
    dueDate: date("due_date"),
    paidDate: date("paid_date"),                                     // KRITISKT vid kontantmetoden!
    // Redovisningsdatum för momsen. Styr vilket år/kvartal momsen hamnar.
    // Sätts t.ex. till 31 dec för decemberarbete som faktureras året efter
    // (kundfordran bokförs på arbetsåret, moms på det året — inte betalåret).
    vatDate: date("vat_date"),
    // Externt fakturanummer — för fakturor skapade i ett annat system
    externalInvoiceNumber: text("external_invoice_number"),                // manuellt ifyllt
    // Genererad faktura (appen som fakturakälla sedan aug 2026)
    invoiceNumber: integer("invoice_number"),                        // löpnummer: 730, 731, 732 ... (sätts av API:t)
    invoiceLines: jsonb("invoice_lines").default([]),                // InvoiceLine[] — radposter på fakturan
    buyerName: text("buyer_name"),                                   // Köpare (t.ex. förmedlingspartnern) — kan skilja sig från slutkunden
    buyerDetails: jsonb("buyer_details"),                            // InvoiceBuyerDetails — adress-snapshot vid skapandet
    invoiceText: text("invoice_text"),                               // fritextrad på fakturan (slutkund, avtal, period)
    paymentTermsDays: integer("payment_terms_days"),                 // betalningsvillkor i dagar
    // Frusen tidrapportbilaga (TimeReportEntry[]) — tas vid skapandet så
    // PDF:en återskapas identiskt även om tidsposterna ändras i efterhand
    timeReportSnapshot: jsonb("time_report_snapshot"),
    // Avstämning mot tidsposter
    linkedTimeEntryIds: jsonb("linked_time_entry_ids").default([]),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_invoice_packages_user_status").on(table.userId, table.status),
    index("idx_invoice_packages_user_paiddate").on(table.userId, table.paidDate),
    uniqueIndex("uq_invoice_packages_user_number").on(table.userId, table.invoiceNumber),
  ]
);

// ============================================================================
// VAT EVENTS (Moms-händelser — utgående och ingående moms)
// ============================================================================

export const vatEvents = pgTable(
  "vat_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    // Datum när moms räknas (= betalningsdatum vid kontantmetoden)
    eventDate: date("event_date").notNull(),
    description: text("description").notNull(),
    supplier: text("supplier"),                                      // Leverantör/kund
    // Belopp
    amountSek: numeric("amount_sek").notNull(),                      // Brutto exkl moms (eller nettobelopp)
    vatRate: numeric("vat_rate").default("0.25"),                    // 0 / 0.06 / 0.12 / 0.25
    outgoingVat: numeric("outgoing_vat").default("0"),               // Utgående moms
    incomingVat: numeric("incoming_vat").default("0"),               // Ingående moms (avdragsgill)
    // Typ av händelse
    eventType: text("event_type").notNull(),                         // sales | purchase_se | purchase_eu | purchase_non_eu | reverse_charge | other
    // Bokföring
    basAccount: text("bas_account"),                                 // 3001 / 6540 / 4531 etc.
    // Koppling
    invoicePackageId: uuid("invoice_package_id"),                    // Om händelsen kom från ett fakturapaket
    scenarioKey: text("scenario_key"),                               // Vilket kunskapsbas-scenario (t.ex. "ai-service-usa")
    // Metadata
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_vat_events_user_date").on(table.userId, table.eventDate),
    index("idx_vat_events_user_type").on(table.userId, table.eventType),
  ]
);

// ============================================================================
// TRIPS (resor / milersättning)
// ============================================================================

export const trips = pgTable(
  "trips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    // Frikopplad från projects (ingen FK) så en resa överlever soft-delete och
    // kan finnas utan uppdrag. Titel/kund sparas som snapshot för underlaget.
    projectId: uuid("project_id"),
    projectTitle: text("project_title"),
    customerName: text("customer_name"),
    date: date("date").notNull(),
    purpose: text("purpose"),                 // syfte
    fromTo: text("from_to"),                  // sträcka från–till
    km: numeric("km").default("0"),                   // sträcka enkel väg
    roundTrip: boolean("round_trip").default(false),  // TOR — dubblar sträckan
    ratePerKm: numeric("rate_per_km").default("2.5"), // fryst sats (kr/km)
    parkingSek: numeric("parking_sek").default("0"),
    tollsSek: numeric("tolls_sek").default("0"),      // trängselskatt/vägavgift
    otherSek: numeric("other_sek").default("0"),
    receipts: jsonb("receipts").default([]),  // [{ name, dataUrl }] base64
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_trips_user_date").on(table.userId, table.date),
    index("idx_trips_project").on(table.projectId),
  ]
);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type TimeEntry = typeof timeEntries.$inferSelect;
export type NewTimeEntry = typeof timeEntries.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type CustomerCommunication = typeof customerCommunications.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type ProjectTemplate = typeof projectTemplates.$inferSelect;
export type InvoicePackage = typeof invoicePackages.$inferSelect;
export type NewInvoicePackage = typeof invoicePackages.$inferInsert;
export type VatEvent = typeof vatEvents.$inferSelect;
export type NewVatEvent = typeof vatEvents.$inferInsert;
export type Trip = typeof trips.$inferSelect;
export type NewTrip = typeof trips.$inferInsert;
