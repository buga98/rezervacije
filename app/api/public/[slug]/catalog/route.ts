import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    include: {
      categories: { orderBy: { sortOrder: "asc" }, include: { services: { where: { active: true, onlineBookable: true }, orderBy: { sortOrder: "asc" } } } },
      staff: { where: { bookable: true, user: { active: true } }, orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }], include: { services: true } },
    },
  });
  if (!tenant || !tenant.allowOnlineBooking) return NextResponse.json({ error: "Salon nije dostupan." }, { status: 404 });
  return NextResponse.json({
    tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name, timezone: tenant.timezone, currency: tenant.currency, cancellationHours: tenant.cancellationHours, requireDeposit: tenant.requireDeposit, depositPercent: tenant.depositPercent },
    categories: tenant.categories,
    staff: tenant.staff.map(s => ({ id: s.id, displayName: s.displayName, bio: s.bio, color: s.color, serviceIds: s.services.map(x => x.serviceId) })),
  });
}
