import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";

const schema = z.object({ email: z.email(), password: z.string().min(6) });
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Neispravni podaci." }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (!user || !user.active || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return NextResponse.json({ error: "Pogrešan email ili lozinka." }, { status: 401 });
  }
  await createSession({ userId: user.id, tenantId: user.tenantId, role: user.role });
  return NextResponse.json({ ok: true, redirect: user.role === "SUPERADMIN" ? "/superadmin" : "/dashboard" });
}
