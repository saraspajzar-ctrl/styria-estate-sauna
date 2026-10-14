import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/dal";
import { getSaunaResource } from "@/lib/db/resource";
import { getAdminSchedule } from "@/lib/db/schedule";
import { isValidISODate } from "@/lib/time";

export async function GET(req: NextRequest) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const date = req.nextUrl.searchParams.get("date");
  if (!date || !isValidISODate(date)) {
    return NextResponse.json({ error: "A valid date is required." }, { status: 400 });
  }

  const resource = await getSaunaResource();
  const slots = await getAdminSchedule(resource.id, date);
  return NextResponse.json({ resource, slots });
}
