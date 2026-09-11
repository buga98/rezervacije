import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user || !user.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sub = await req.json();
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  await prisma.pushSubscription.upsert({
    where: { tenantId_endpoint: { tenantId: user.tenantId, endpoint: sub.endpoint } },
    create: { tenantId: user.tenantId, userId: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: req.headers.get("user-agent") },
    update: { userId: user.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: req.headers.get("user-agent") },
  });
  return NextResponse.json({ ok: true });
}
