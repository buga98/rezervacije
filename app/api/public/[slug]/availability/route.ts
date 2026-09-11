import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAvailableSlots } from "@/lib/booking/availability";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date"); const serviceId = searchParams.get("serviceId"); const staffId = searchParams.get("staffId");
  if (!date || !serviceId) return NextResponse.json({ error: "Nedostaje datum ili usluga." }, { status: 400 });
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) return NextResponse.json({ error: "Salon nije pronađen." }, { status: 404 });
  const slots = await getAvailableSlots({ tenantId: tenant.id, date, serviceId, staffId: staffId && staffId !== "any" ? staffId : null });
  return NextResponse.json({ slots });
}
