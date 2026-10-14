import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin/dal";
import { listAdminReservations } from "@/lib/db/admin-reservations";
import { bookReservation } from "@/lib/db/reservations";
import { getSaunaResource } from "@/lib/db/resource";
import { parseDbError, statusForCode } from "@/lib/db/errors";
import { isValidISODate } from "@/lib/time";

export async function GET(req: NextRequest) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const date = req.nextUrl.searchParams.get("date") ?? undefined;
  const apartmentId = req.nextUrl.searchParams.get("apartmentId") ?? undefined;
  const stayId = req.nextUrl.searchParams.get("stayId") ?? undefined;
  const status = req.nextUrl.searchParams.get("status") ?? undefined;

  const reservations = await listAdminReservations({ date, apartmentId, stayId, status });
  return NextResponse.json({ reservations });
}

const createSchema = z.object({
  stayId: z.string().min(1),
  reservationDate: z.string().refine(isValidISODate),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  durationMinutes: z.number().int(),
  numberOfGuests: z.number().int(),
});

export async function POST(req: NextRequest) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid booking details." }, { status: 400 });
  }

  try {
    const resource = await getSaunaResource();
    const reservation = await bookReservation({
      stayId: parsed.data.stayId,
      resourceId: resource.id,
      reservationDate: parsed.data.reservationDate,
      startTime: parsed.data.startTime,
      durationMinutes: parsed.data.durationMinutes,
      numberOfGuests: parsed.data.numberOfGuests,
      isAdmin: true,
      adminUserId: admin.userId,
    });
    return NextResponse.json({ reservation });
  } catch (err) {
    const { code, message } = parseDbError(err as { message?: string });
    return NextResponse.json({ error: message, code }, { status: statusForCode(code) });
  }
}
