import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { trips } from "@/lib/db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { stripProtected } from "@/lib/api-guard";

// Numeriska fält castas till string för Drizzle numeric.
const NUMERIC_FIELDS = [
  "km",
  "ratePerKm",
  "parkingSek",
  "tollsSek",
  "otherSek",
];

function coerceNumerics(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...body };
  for (const f of NUMERIC_FIELDS) {
    if (out[f] !== undefined && out[f] !== null) out[f] = String(out[f]);
  }
  return out;
}

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const year = url.searchParams.get("year");

    const conditions = [eq(trips.userId, userId)];
    if (year) {
      conditions.push(gte(trips.date, `${year}-01-01`));
      conditions.push(lte(trips.date, `${year}-12-31`));
    }

    const rows = await db
      .select()
      .from(trips)
      .where(and(...conditions))
      .orderBy(desc(trips.date));

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error fetching trips:", error);
    return NextResponse.json(
      { error: "Failed to fetch trips" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = stripProtected(await req.json());

    const [row] = await db
      .insert(trips)
      .values({ ...coerceNumerics(body), userId } as typeof trips.$inferInsert)
      .returning();

    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    console.error("Error creating trip:", error);
    return NextResponse.json(
      { error: "Failed to create trip" },
      { status: 500 }
    );
  }
}
