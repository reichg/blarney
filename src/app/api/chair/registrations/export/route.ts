import {
  buildChairRegistrationCsv,
  type ChairRegistrationExportScope,
} from "@/lib/chairRegistrationExport";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function getRegistrations() {
  return await db.registration.findMany({
    select: {
      paymentStatus: true,
      packageSelection: true,
      adultGuestCount: true,
      childGuestCount: true,
      checkout: {
        select: {
          email: true,
        },
      },
      participant: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          age: true,
          gender: true,
          averageScore: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

function getExportScope(request: NextRequest): ChairRegistrationExportScope {
  return request.nextUrl.searchParams.get("scope") === "golfers"
    ? "golfers"
    : "general";
}

function getExportFilename(scope: ChairRegistrationExportScope): string {
  return scope === "golfers"
    ? "blarney-42-golfer-registrations.csv"
    : "blarney-42-registrations.csv";
}

export async function GET(request: NextRequest) {
  try {
    const scope = getExportScope(request);
    const registrations = await getRegistrations();
    const csv = buildChairRegistrationCsv(registrations, scope);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${getExportFilename(scope)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to export registrations:", error);
    return new NextResponse("Failed to export registrations", {
      status: 500,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }
}
