import { NextRequest, NextResponse } from "next/server";
import { getGuestSession } from "@/lib/guest/session";
import { getDailyAllowanceForStay } from "@/lib/db/reservations";
import { isValidISODate } from "@/lib/time";

export async function GET(req: NextRequest) {
  const session = await getGuestSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const date = req.nextUrl.searchParams.get("date");
  if (!date || !isValidISODate(date)) {
    return NextResponse.json({ error: "A valid date is required." }, { status: 400 });
  }
  const exclude = req.nextUrl.searchParams.get("exclude") ?? undefined;

  const allowance = await getDailyAllowanceForStay(session.stayId, date, exclude);
  return NextResponse.json({ allowance });
}
