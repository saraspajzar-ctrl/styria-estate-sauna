import { NextResponse } from "next/server";
import { getGuestSession } from "@/lib/guest/session";
import { getStayById } from "@/lib/db/stays";
import { GuestStayView } from "@/lib/types";

export async function GET() {
  const session = await getGuestSession();
  if (!session) return NextResponse.json({ stay: null }, { status: 401 });

  const stay = await getStayById(session.stayId);
  if (!stay || stay.status !== "active") {
    return NextResponse.json({ stay: null }, { status: 401 });
  }

  const view: GuestStayView = {
    apartmentName: stay.apartment?.name ?? "",
    checkIn: stay.check_in,
    checkOut: stay.check_out,
  };
  return NextResponse.json({ stay: view });
}
