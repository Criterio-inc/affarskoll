import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { vatEvents } from "@/lib/db/schema";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const yearParam = url.searchParams.get("year");
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");

    let conditions = eq(vatEvents.userId, userId);

    if (yearParam) {
      const year = Number(yearParam);
      if (Number.isFinite(year)) {
        conditions = and(
          conditions,
          gte(vatEvents.eventDate, `${year}-01-01`),
          lte(vatEvents.eventDate, `${year}-12-31`)
        )!;
      }
    } else if (fromParam && toParam) {
      conditions = and(
        conditions,
        gte(vatEvents.eventDate, fromParam),
        lte(vatEvents.eventDate, toParam)
      )!;
    }

    const rows = await db
      .select()
      .from(vatEvents)
      .where(conditions)
      .orderBy(desc(vatEvents.eventDate));

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error fetching VAT events:", error);
    return NextResponse.json(
      { error: "Failed to fetch VAT events" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    if (!body.eventDate || !body.description || !body.amountSek) {
      return NextResponse.json(
        { error: "eventDate, description och amountSek är obligatoriska" },
        { status: 400 }
      );
    }

    const amountSek = Number(body.amountSek);
    const vatRate = Number(body.vatRate ?? 0.25);

    // Auto-räkna moms om inte explicit angivet
    let outgoingVat = body.outgoingVat !== undefined ? Number(body.outgoingVat) : 0;
    let incomingVat = body.incomingVat !== undefined ? Number(body.incomingVat) : 0;

    if (outgoingVat === 0 && incomingVat === 0) {
      const eventType = body.eventType ?? "purchase_se";
      const computed = amountSek * vatRate;
      switch (eventType) {
        case "sales":
          outgoingVat = computed;
          break;
        case "purchase_se":
          incomingVat = computed;
          break;
        case "purchase_eu":
        case "purchase_non_eu":
        case "reverse_charge":
          // Omvänd skattskyldighet: BÅDE utgående och ingående (netto 0)
          outgoingVat = computed;
          incomingVat = computed;
          break;
        default:
          break;
      }
    }

    const [row] = await db
      .insert(vatEvents)
      .values({
        userId,
        eventDate: body.eventDate,
        description: body.description,
        supplier: body.supplier ?? null,
        amountSek: String(amountSek),
        vatRate: String(vatRate),
        outgoingVat: String(outgoingVat),
        incomingVat: String(incomingVat),
        eventType: body.eventType ?? "purchase_se",
        basAccount: body.basAccount ?? null,
        invoicePackageId: body.invoicePackageId ?? null,
        scenarioKey: body.scenarioKey ?? null,
        notes: body.notes ?? null,
      })
      .returning();

    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    console.error("Error creating VAT event:", error);
    return NextResponse.json(
      { error: "Failed to create VAT event" },
      { status: 500 }
    );
  }
}
