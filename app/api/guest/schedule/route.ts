import { NextRequest, NextResponse } from "next/server";
import { getGuestSession } from "@/lib/guest/session";
import { getSaunaResource } from "@/lib/db/resource";
import { getPublicSchedule } from "@/lib/db/schedule";
import { isValidISODate } from "@/lib/time";

export async function GET(req: NextRequest) {
  const session = await getGuestSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const date = req.nextUrl.searchParams.get("date");
  if (!date || !isValidISODate(date)) {
    return NextResponse.json({ error: "A valid date is required." }, { status: 400 });
  }

  const resource = await getSaunaResource();
  const slots = await getPublicSchedule(resource.id, date, session.stayId);
  return NextResponse.json({ resource, slots });
}
