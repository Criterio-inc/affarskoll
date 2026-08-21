import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { customerCommunications } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const communications = await db
      .select()
      .from(customerCommunications)
      .where(
        and(
          eq(customerCommunications.customerId, id),
          eq(customerCommunications.userId, userId)
        )
      )
      .orderBy(desc(customerCommunications.createdAt));

    return NextResponse.json(communications);
  } catch (error) {
    console.error("Error fetching communications:", error);
    return NextResponse.json({ error: "Failed to fetch communications" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();

    const [communication] = await db
      .insert(customerCommunications)
      .values({
        ...body,
        userId,
        customerId: id,
      })
      .returning();

    return NextResponse.json(communication, { status: 201 });
  } catch (error) {
    console.error("Error creating communication:", error);
    return NextResponse.json({ error: "Failed to create communication" }, { status: 500 });
  }
}
