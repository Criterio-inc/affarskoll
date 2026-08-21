// Server-side notification generator.
// Scans a user's projects/time entries and creates notifications for:
// - Budget warnings (80% / 90%)
// - Contract expiry (<14 days)
// - Billing reminders (based on billingDate)
// - Weekly summary (at end of week)

import { db } from "@/lib/db";
import {
  projects as projectsTable,
  timeEntries as timeEntriesTable,
  notifications as notificationsTable,
  invoicePackages as invoicePackagesTable,
  userSettings as userSettingsTable,
} from "@/lib/db/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { getSafeSettings, type AppSettings } from "@/lib/settings";
import {
  getVatOccasions,
  nextUpcomingOccasion,
  formatDeadlineSv,
} from "@/lib/vat";

export interface GenerationResult {
  created: number;
  skipped: number;
  types: Record<string, number>;
}

/** Returns true if a similar notification already exists for this user (unread, last 7 days). */
async function hasRecentSimilar(
  userId: string,
  type: string,
  projectId: string | null
): Promise<boolean> {
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const existing = await db
    .select()
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.userId, userId),
        eq(notificationsTable.type, type),
        gte(notificationsTable.createdAt, since)
      )
    );

  return existing.some(
    (n) => (n.projectId ?? null) === (projectId ?? null) && !n.read
  );
}

async function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  projectId: string | null
): Promise<boolean> {
  if (await hasRecentSimilar(userId, type, projectId)) return false;
  await db.insert(notificationsTable).values({
    userId,
    type,
    title,
    message,
    projectId,
    read: false,
  });
  return true;
}

/**
 * Generate notifications for one user. Called from /api/notifications/generate
 * and from the daily cron route.
 */
export async function generateUserNotifications(
  userId: string
): Promise<GenerationResult> {
  const result: GenerationResult = {
    created: 0,
    skipped: 0,
    types: {},
  };

  const bump = (type: string, created: boolean) => {
    if (created) {
      result.created++;
      result.types[type] = (result.types[type] ?? 0) + 1;
    } else {
      result.skipped++;
    }
  };

  // Load projects + time entries
  const userProjects = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.userId, userId));

  const userEntries = await db
    .select()
    .from(timeEntriesTable)
    .where(eq(timeEntriesTable.userId, userId));

  const today = new Date();

  // 1. BUDGET WARNINGS (only aktiv projects)
  for (const project of userProjects) {
    if (project.status !== "aktiv") continue;
    const budgeted = Number(project.budgetedHours ?? 0);
    if (budgeted <= 0) continue;

    const used = userEntries
      .filter((e) => e.projectId === project.id)
      .reduce((sum, e) => sum + Number(e.hours), 0);

    const pct = (used / budgeted) * 100;

    if (pct >= 90) {
      // Egen typ så en oläst 80%-varning inte kväver den kritiska 90%-varningen.
      const created = await createNotification(
        userId,
        "budget_critical",
        `Budget 90%: ${project.title}`,
        `${used.toFixed(1)} av ${budgeted} timmar använda (${Math.round(pct)}%).`,
        project.id
      );
      bump("budget_critical", created);
    } else if (pct >= 80) {
      const created = await createNotification(
        userId,
        "budget_warning",
        `Budget 80%: ${project.title}`,
        `${used.toFixed(1)} av ${budgeted} timmar använda (${Math.round(pct)}%).`,
        project.id
      );
      bump("budget_warning", created);
    }
  }

  // 2. CONTRACT EXPIRY (aktiv, end date within 14 days)
  for (const project of userProjects) {
    if (project.status !== "aktiv") continue;
    try {
      const endDate = parseISO(project.endDate);
      const daysLeft = differenceInCalendarDays(endDate, today);
      if (daysLeft >= 0 && daysLeft <= 14) {
        const created = await createNotification(
          userId,
          "contract_expiry",
          `Uppdrag avslutas snart: ${project.title}`,
          `Slutdatum om ${daysLeft} dagar (${project.endDate}). Dags för förlängning eller avslut?`,
          project.id
        );
        bump("contract_expiry", created);
      }
    } catch {
      // skip invalid dates
    }
  }

  // 3. BILLING REMINDERS (within 3 days of billing date for this month)
  for (const project of userProjects) {
    if (project.status !== "aktiv") continue;
    if (!project.billingDate) continue;

    const thisMonthBilling = new Date(
      today.getFullYear(),
      today.getMonth(),
      project.billingDate
    );
    const daysUntilBilling = differenceInCalendarDays(thisMonthBilling, today);

    if (daysUntilBilling >= 0 && daysUntilBilling <= 3) {
      const created = await createNotification(
        userId,
        "billing_reminder",
        `Dags att fakturera: ${project.title}`,
        `Faktureringsdag ${project.billingDate}:e denna månad (om ${daysUntilBilling} dagar).`,
        project.id
      );
      bump("billing_reminder", created);
    }
  }

  // 4. MOMS-PÅMINNELSE (period-medveten: kvartal eller helår)
  const [settingsRow] = await db
    .select()
    .from(userSettingsTable)
    .where(eq(userSettingsTable.userId, userId));
  const vatSettings = getSafeSettings(
    (settingsRow?.settings ?? null) as Partial<AppSettings> | null
  );
  const todayIso = today.toISOString().slice(0, 10);

  if (vatSettings.vatReportingPeriod === "quarterly") {
    // Titta på i år + nästa år (Q4 deklareras i februari året efter).
    const occasions = [
      ...getVatOccasions(
        today.getFullYear(),
        "quarterly",
        vatSettings.vatQuarterlyFromYear
      ),
      ...getVatOccasions(
        today.getFullYear() + 1,
        "quarterly",
        vatSettings.vatQuarterlyFromYear
      ),
    ];
    const next = nextUpcomingOccasion(occasions, todayIso);
    if (next) {
      const daysLeft = differenceInCalendarDays(parseISO(next.deadline), today);
      // Påminn inom ca 25 dagar före deadline.
      if (daysLeft >= 0 && daysLeft <= 25) {
        const created = await createNotification(
          userId,
          "vat_reminder",
          `Snart dags att momsdeklarera (${next.label})`,
          `Momsdeklarationen för ${next.label} ska lämnas senast ${formatDeadlineSv(
            next.deadline
          )} — om ${daysLeft} dagar. Kontrollera momsloggen under Ekonomi.`,
          null
        );
        if (created) {
          result.created++;
          result.types.vat_reminder = (result.types.vat_reminder ?? 0) + 1;
        }
      }
    }
  } else if (vatSettings.vatReportingPeriod === "yearly") {
    // Aktiebolag med kalenderår + årsmoms utan EU-handel: deklarationen lämnas
    // i anslutning till INK2. Deadline ~1-17 augusti. Varna i juni–juli.
    const month = today.getMonth(); // 0-indexed
    if (month === 5 || month === 6) {
      const declarationYear = today.getFullYear() - 1;
      const created = await createNotification(
        userId,
        "vat_reminder",
        `Snart deadline för momsdeklaration ${declarationYear}`,
        `Eftersom du är aktiebolag med årsmoms och utan EU-handel ska momsen för ${declarationYear} deklareras i anslutning till INK2 — senast omkring 1–17 augusti. Kontrollera momsloggen under Ekonomi.`,
        null
      );
      if (created) {
        result.created++;
        result.types.vat_reminder = (result.types.vat_reminder ?? 0) + 1;
      }
    }
  }

  // 5. OBETALDA FAKTUROR (skickade men ej betalda > 30 dagar förfallna)
  const allInvoices = await db
    .select()
    .from(invoicePackagesTable)
    .where(eq(invoicePackagesTable.userId, userId));

  for (const inv of allInvoices) {
    if (inv.status !== "skickad") continue;
    if (!inv.dueDate) continue;
    try {
      const dueDate = parseISO(inv.dueDate);
      const daysOverdue = differenceInCalendarDays(today, dueDate);
      if (daysOverdue > 30) {
        const created = await createNotification(
          userId,
          "billing_reminder",
          `Faktura förfallen: ${inv.dooerInvoiceNumber ?? inv.projectTitle}`,
          `Skickad faktura till ${inv.customerName} har varit förfallen i ${daysOverdue} dagar utan betalning. Belopp: ${Math.round(Number(inv.totalInclVat))} kr inkl moms.`,
          inv.projectId
        );
        bump("billing_reminder", created);
      }
    } catch {
      // skip invalid dates
    }
  }

  return result;
}

/**
 * Weekly summary for one user. Sums the past 7 days of work + billable hours.
 * Creates a "weekly_summary" notification. Meant to be run once per week by cron.
 */
export async function generateWeeklySummary(
  userId: string
): Promise<GenerationResult> {
  const result: GenerationResult = {
    created: 0,
    skipped: 0,
    types: {},
  };

  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const entries = await db
    .select()
    .from(timeEntriesTable)
    .where(
      and(
        eq(timeEntriesTable.userId, userId),
        gte(timeEntriesTable.date, weekAgo.toISOString().slice(0, 10)),
        lte(timeEntriesTable.date, now.toISOString().slice(0, 10))
      )
    );

  const userProjects = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.userId, userId));

  const totalHours = entries.reduce((s, e) => s + Number(e.hours), 0);
  const billableHours = entries
    .filter((e) => e.isBillable !== false && e.category !== "ej_debiterbar")
    .reduce((s, e) => s + Number(e.hours), 0);

  let grossRevenue = 0;
  for (const e of entries) {
    if (e.isBillable === false || e.category === "ej_debiterbar") continue;
    const p = userProjects.find((pr) => pr.id === e.projectId);
    if (!p) continue;
    if (p.contractType === "timpris" || p.contractType === "blandat") {
      grossRevenue += Number(e.hours) * Number(p.hourlyRate ?? 0);
    }
  }

  const created = await createNotification(
    userId,
    "weekly_summary",
    `Veckosammanfattning`,
    `${totalHours.toFixed(1)}h totalt, ${billableHours.toFixed(1)}h debiterbart, ca ${Math.round(grossRevenue).toLocaleString("sv-SE")} kr bruttointäkt.`,
    null
  );

  if (created) {
    result.created = 1;
    result.types.weekly_summary = 1;
  } else {
    result.skipped = 1;
  }

  return result;
}

/**
 * Auto-close projects where end_date has passed and status = aktiv.
 */
export async function autoCloseExpiredProjects(
  userId?: string
): Promise<{ closed: number; ids: string[] }> {
  const todayISO = new Date().toISOString().slice(0, 10);

  const query = userId
    ? db
        .select()
        .from(projectsTable)
        .where(
          and(
            eq(projectsTable.userId, userId),
            eq(projectsTable.status, "aktiv")
          )
        )
    : db.select().from(projectsTable).where(eq(projectsTable.status, "aktiv"));

  const active = await query;
  const expired = active.filter((p) => p.endDate < todayISO);

  for (const p of expired) {
    await db
      .update(projectsTable)
      .set({ status: "avslutad" })
      .where(eq(projectsTable.id, p.id));

    // Notify the owner
    await createNotification(
      p.userId,
      "contract_expiry",
      `Uppdrag automatiskt avslutat: ${p.title}`,
      `Slutdatum ${p.endDate} har passerat. Uppdraget är nu markerat som avslutat.`,
      p.id
    );
  }

  return { closed: expired.length, ids: expired.map((p) => p.id) };
}
