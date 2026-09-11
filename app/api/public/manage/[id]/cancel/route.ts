import { NextResponse } from "next/server";
import { cancelAppointmentByToken } from "@/lib/booking/create-appointment";
import { queueCancellationNotifications } from "@/lib/notifications/queue";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { token } = await req.json();
  try {
    const appointment = await cancelAppointmentByToken(id, String(token || ""));
    await queueCancellationNotifications(appointment.id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const code = String(e?.message || e);
    return NextResponse.json({ error: code === "CANCELLATION_WINDOW_CLOSED" ? "Rok za online otkazivanje je istekao. Kontaktirajte salon." : "Link nije valjan ili je istekao.", code }, { status: code === "CANCELLATION_WINDOW_CLOSED" ? 409 : 403 });
  }
}
