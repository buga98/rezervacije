import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { createAppointment } from "@/lib/booking/create-appointment";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user || !user.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  try {
    const result = await createAppointment({ tenantId: user.tenantId, serviceId: body.serviceId, staffId: body.staffId, startsAt: body.startsAt, customer: body.customer, source: "WALK_IN" });
    return NextResponse.json({ id: result.appointment.id }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 409 });
  }
}
