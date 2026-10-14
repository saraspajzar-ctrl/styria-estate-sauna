import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin/dal";
import { cancelReservation, updateReservation } from "@/lib/db/reservations";
import { parseDbError, statusForCode } from "@/lib/db/errors";
import { isValidISODate } from "@/lib/time";

const updateSchema = z.object({
  reservationDate: z.string().refine(isValidISODate),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  durationMinutes: z.number().int(),
  numberOfGuests: z.number().int(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid booking details." }, { status: 400 });
  }

  try {
    const reservation = await updateReservation({
      reservationId: id,
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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  try {
    await cancelReservation(id, undefined, true, admin.userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { code, message } = parseDbError(err as { message?: string });
    return NextResponse.json({ error: message, code }, { status: statusForCode(code) });
  }
}
