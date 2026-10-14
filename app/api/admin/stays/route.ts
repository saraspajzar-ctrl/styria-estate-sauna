import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin/dal";
import { listStays } from "@/lib/db/stays";
import { adminCreateStay } from "@/lib/db/admin-stays";
import { isValidISODate } from "@/lib/time";

export async function GET(req: NextRequest) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const apartmentId = req.nextUrl.searchParams.get("apartmentId") ?? undefined;
  const status = req.nextUrl.searchParams.get("status") ?? undefined;
  const stays = await listStays({ apartmentId, status });
  return NextResponse.json({ stays });
}

const createSchema = z.object({
  apartmentId: z.string().min(1),
  guestSurname: z.string().trim().min(1).max(100),
  checkIn: z.string().refine(isValidISODate),
  checkOut: z.string().refine(isValidISODate),
});

export async function POST(req: NextRequest) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }
  if (parsed.data.checkOut <= parsed.data.checkIn) {
    return NextResponse.json(
      { error: "Check-out date must be after the check-in date." },
      { status: 400 }
    );
  }

  try {
    const { stay, accessCode } = await adminCreateStay({
      apartmentId: parsed.data.apartmentId,
      guestSurname: parsed.data.guestSurname,
      checkIn: parsed.data.checkIn,
      checkOut: parsed.data.checkOut,
      adminUserId: admin.userId,
    });
    return NextResponse.json({ stay, accessCode });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Could not create stay." },
      { status: 400 }
    );
  }
}
