import { db } from "@/lib/db";
import {
  REMEMBRANCE_FEEDBACK_CATEGORY,
  remembranceSubmissionSchema,
} from "@/lib/remembrance";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const parsed = remembranceSubmissionSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Remembrance text is required." },
      { status: 400 },
    );
  }

  try {
    const feedback = await db.feedback.create({
      data: {
        category: REMEMBRANCE_FEEDBACK_CATEGORY,
        email: parsed.data.email?.toLowerCase(),
        message: parsed.data.message,
        name: parsed.data.name,
        rating: null,
      },
      select: { id: true },
    });

    return NextResponse.json({ feedbackId: feedback.id });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Remembrance could not be saved.",
      },
      { status: 500 },
    );
  }
}
