import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user || !user.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const from = new Date(searchParams.get("from") || Date.now() - 86400000);
  const to = new Date(searchParams.get("to") || Date.now() + 7 * 86400000);
  const rows = await prisma.appointment.findMany({
    where: { tenantId: user.tenantId, startsAt: { gte: from, lt: to }, ...(user.role === "STAFF" && user.staffProfile ? { staffId: user.staffProfile.id } : {}) },
    include: { service: true, staff: true, customer: true },
    orderBy: { startsAt: "asc" },
  });
  return NextResponse.json(rows);
}
