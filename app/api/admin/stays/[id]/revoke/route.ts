import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/dal";
import { adminRevokeAccessCode } from "@/lib/db/admin-stays";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  try {
    await adminRevokeAccessCode(id, admin.userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
