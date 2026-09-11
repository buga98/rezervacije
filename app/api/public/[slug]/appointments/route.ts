import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createAppointment } from "@/lib/booking/create-appointment";

const schema = z.object({
  serviceId: z.string().min(1),
  staffId: z.string().nullable().optional(),
  startsAt: z.iso.datetime(),
  customer: z.object({ name: z.string().min(2).max(100), phone: z.string().min(6).max(30), email: z.union([z.email(), z.literal("")]).optional(), note: z.string().max(1000).optional() }),
});

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = schema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "Provjerite unesene podatke." }, { status: 400 });
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) return NextResponse.json({ error: "Salon nije pronađen." }, { status: 404 });
  try {
    const { appointment, manageToken } = await createAppointment({
      tenantId: tenant.id,
      serviceId: body.data.serviceId,
      staffId: body.data.staffId === "any" ? null : body.data.staffId,
      startsAt: body.data.startsAt,
      customer: { ...body.data.customer, email: body.data.customer.email || null },
    });
    return NextResponse.json({
      id: appointment.id,
      status: appointment.status,
      manageUrl: `${process.env.APP_URL || ""}/manage/${appointment.id}?token=${encodeURIComponent(manageToken)}`,
      requiresPayment: tenant.requireDeposit,
      depositCents: appointment.depositCents,
    }, { status: 201 });
  } catch (e: any) {
    const msg = String(e?.message || e);
    const status = ["SLOT_UNAVAILABLE", "SLOT_TAKEN_RACE"].includes(msg) ? 409 : msg === "CUSTOMER_BLOCKED" ? 403 : 500;
    return NextResponse.json({ error: status === 409 ? "Termin je upravo zauzet. Odaberite drugi slobodan termin." : "Rezervaciju nije moguće spremiti.", code: msg }, { status });
  }
}
