import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/dal";
import { getDailyAllowanceForStay } from "@/lib/db/reservations";
import { isValidISODate } from "@/lib/time";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const date = req.nextUrl.searchParams.get("date");
  if (!date || !isValidISODate(date)) {
    return NextResponse.json({ error: "A valid date is required." }, { status: 400 });
  }

  const allowance = await getDailyAllowanceForStay(id, date);
  return NextResponse.json({ allowance });
}
