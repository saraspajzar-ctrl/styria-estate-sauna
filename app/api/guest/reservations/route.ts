import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getGuestSession } from "@/lib/guest/session";
import { getSaunaResource } from "@/lib/db/resource";
import { bookReservation, listReservationsForStay } from "@/lib/db/reservations";
import { parseDbError, statusForCode } from "@/lib/db/errors";
import { isValidISODate } from "@/lib/time";

export async function GET() {
  const session = await getGuestSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const reservations = await listReservationsForStay(session.stayId);
  return NextResponse.json({ reservations });
}

const createSchema = z.object({
  reservationDate: z.string().refine(isValidISODate),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  durationMinutes: z.number().int(),
});

export async function POST(req: NextRequest) {
  const session = await getGuestSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid booking details." }, { status: 400 });
  }

  try {
    const resource = await getSaunaResource();
    const reservation = await bookReservation({
      stayId: session.stayId,
      resourceId: resource.id,
      reservationDate: parsed.data.reservationDate,
      startTime: parsed.data.startTime,
      durationMinutes: parsed.data.durationMinutes,
    });
    return NextResponse.json({ reservation });
  } catch (err) {
    const { code, message } = parseDbError(err as { message?: string });
    return NextResponse.json({ error: message, code }, { status: statusForCode(code) });
  }
}
