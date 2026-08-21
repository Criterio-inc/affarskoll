import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

// Ny användare startar med tomt objekt — klienten fyller ut med
// DEFAULT_SETTINGS via getSafeSettings tills något sparas.
const defaultSettings = {};

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [existing] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId));

    if (existing) {
      return NextResponse.json(existing);
    }

    // Create default settings if none exist
    const [created] = await db
      .insert(userSettings)
      .values({
        userId,
        settings: defaultSettings,
      })
      .returning();

    return NextResponse.json(created);
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    const [existing] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId));

    if (existing) {
      const [updated] = await db
        .update(userSettings)
        .set({
          settings: body.settings,
          updatedAt: new Date(),
        })
        .where(eq(userSettings.userId, userId))
        .returning();

      return NextResponse.json(updated);
    }

    // Create if doesn't exist
    const [created] = await db
      .insert(userSettings)
      .values({
        userId,
        settings: body.settings,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
