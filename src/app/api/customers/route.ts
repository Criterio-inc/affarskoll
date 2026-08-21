import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { stripProtected } from "@/lib/api-guard";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userCustomers = await db
      .select()
      .from(customers)
      .where(eq(customers.userId, userId))
      .orderBy(desc(customers.createdAt));

    return NextResponse.json(userCustomers);
  } catch (error) {
    console.error("Error fetching customers:", error);
    return NextResponse.json({ error: "Failed to fetch customers" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = stripProtected(await req.json());

    const [customer] = await db
      .insert(customers)
      .values({
        ...body,
        ...(typeof body.name === "string" ? { name: body.name.trim() } : {}),
        ...(body.paymentTermsDays !== undefined
          ? {
              paymentTermsDays:
                body.paymentTermsDays != null && body.paymentTermsDays !== ""
                  ? Number(body.paymentTermsDays)
                  : null,
            }
          : {}),
        userId,
      })
      .returning();

    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    console.error("Error creating customer:", error);
    return NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
  }
}
