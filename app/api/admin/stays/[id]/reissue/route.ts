import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/dal";
import { adminReissueAccessCode } from "@/lib/db/admin-stays";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  try {
    const { stay, accessCode } = await adminReissueAccessCode(id, admin.userId);
    return NextResponse.json({ stay, accessCode });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
