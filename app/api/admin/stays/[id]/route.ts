import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin/dal";
import { adminCancelStay, adminUpdateStayDates } from "@/lib/db/admin-stays";
import { isValidISODate } from "@/lib/time";

const updateSchema = z.object({
  checkIn: z.string().refine(isValidISODate),
  checkOut: z.string().refine(isValidISODate),
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
    return NextResponse.json({ error: "Invalid dates." }, { status: 400 });
  }

  try {
    const stay = await adminUpdateStayDates({
      stayId: id,
      checkIn: parsed.data.checkIn,
      checkOut: parsed.data.checkOut,
      adminUserId: admin.userId,
    });
    return NextResponse.json({ stay });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
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
    await adminCancelStay(id, admin.userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
