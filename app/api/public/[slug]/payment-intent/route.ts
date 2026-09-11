import Stripe from "stripe";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: "Online plaćanje još nije aktivirano." }, { status: 503 });
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const { slug } = await params;
  const { appointmentId } = await req.json();
  const appointment = await prisma.appointment.findFirst({ where: { id: appointmentId, tenant: { slug } }, include: { tenant: true, service: true } });
  if (!appointment || appointment.depositCents <= 0) return NextResponse.json({ error: "Akontacija nije potrebna." }, { status: 400 });
  const intent = await stripe.paymentIntents.create({ amount: appointment.depositCents, currency: appointment.tenant.currency.toLowerCase(), automatic_payment_methods: { enabled: true }, metadata: { appointmentId: appointment.id, tenantId: appointment.tenantId } });
  await prisma.payment.create({ data: { appointmentId: appointment.id, providerRef: intent.id, amountCents: appointment.depositCents } });
  return NextResponse.json({ clientSecret: intent.client_secret });
}
