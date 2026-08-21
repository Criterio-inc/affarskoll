// Daily cron: auto-close expired projects + generate notifications for all users.
// Schedule via vercel.json. Gated by CRON_SECRET.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects as projectsTable } from "@/lib/db/schema";
import {
  autoCloseExpiredProjects,
  generateUserNotifications,
} from "@/lib/notifications-generator";

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
    // Find all unique userIds that own projects
    const rows = await db
      .select({ userId: projectsTable.userId })
      .from(projectsTable);
    const userIds = [...new Set(rows.map((r) => r.userId))];

    // 1) Auto-close expired projects across all users
    const closeResult = await autoCloseExpiredProjects();

    // 2) Generate notifications per user
    const perUser: Record<string, unknown> = {};
    for (const userId of userIds) {
      perUser[userId] = await generateUserNotifications(userId);
    }

    return NextResponse.json({
      ok: true,
      runAt: new Date().toISOString(),
      closedProjects: closeResult.closed,
      users: userIds.length,
      perUser,
    });
  } catch (error) {
    console.error("Daily cron failed:", error);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
