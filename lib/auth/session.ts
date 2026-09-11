import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import type { UserRole } from "@/generated/prisma/client";

const COOKIE = "lp_session";
const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET || "dev-only-change-me");

export type SessionPayload = { userId: string; tenantId: string | null; role: UserRole };

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(secret());
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function readSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function currentUser() {
  const session = await readSession();
  if (!session) return null;
  return prisma.user.findUnique({
    where: { id: session.userId },
    include: { tenant: true, staffProfile: true },
  });
}

export async function requireUser(roles?: UserRole[]) {
  const user = await currentUser();
  if (!user || !user.active) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect("/dashboard");
  return user;
}
