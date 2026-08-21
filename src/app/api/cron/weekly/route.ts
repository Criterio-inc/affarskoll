// Weekly cron: creates a weekly summary notification for every user.
// Scheduled on Sunday evenings via vercel.json.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects as projectsTable } from "@/lib/db/schema";
import { generateWeeklySummary } from "@/lib/notifications-generator";

export const runtime = "nodejs";

function verifyCronSecret(req: Request): boolean {
  const header = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return header === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const rows = await db
      .select({ userId: projectsTable.userId })
      .from(projectsTable);
    const userIds = [...new Set(rows.map((r) => r.userId))];

    const perUser: Record<string, unknown> = {};
    for (const userId of userIds) {
      perUser[userId] = await generateWeeklySummary(userId);
    }

    return NextResponse.json({
      ok: true,
      runAt: new Date().toISOString(),
      users: userIds.length,
      perUser,
    });
  } catch (error) {
    console.error("Weekly cron failed:", error);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
