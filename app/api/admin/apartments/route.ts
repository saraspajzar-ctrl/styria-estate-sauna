import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/dal";
import { listApartments } from "@/lib/db/resource";

export async function GET() {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const apartments = await listApartments();
  return NextResponse.json({ apartments });
}
