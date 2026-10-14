import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hashAccessCode, normalizeAccessCode } from "@/lib/access-code";
import { assertNotRateLimited, getClientIp, hashIp, recordAccessAttempt } from "@/lib/rate-limit";
import { findActiveStayByCodeHash } from "@/lib/db/stays";
import { createGuestSession } from "@/lib/guest/session";
import { GuestStayView } from "@/lib/types";

const schema = z.object({
  code: z.string().trim().min(1).max(32),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please enter your access code." }, { status: 400 });
  }

  const ipHash = hashIp(getClientIp(req));

  try {
    await assertNotRateLimited(ipHash);
  } catch {
    return NextResponse.json(
      { error: "Too many attempts. Please try again in a few minutes." },
      { status: 429 }
    );
  }

  const hash = hashAccessCode(normalizeAccessCode(parsed.data.code));
  const stay = await findActiveStayByCodeHash(hash);

  await recordAccessAttempt(ipHash, !!stay);

  if (!stay) {
    return NextResponse.json({ error: "Invalid or expired access code." }, { status: 401 });
  }

  await createGuestSession(stay.id);

  const view: GuestStayView = {
    apartmentName: stay.apartment?.name ?? "",
    checkIn: stay.check_in,
    checkOut: stay.check_out,
  };
  return NextResponse.json({ stay: view });
}
