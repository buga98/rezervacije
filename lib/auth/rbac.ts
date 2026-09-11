import type { UserRole } from "@/generated/prisma/client";

const rank: Record<UserRole, number> = {
  STAFF: 1,
  MANAGER: 2,
  OWNER: 3,
  SUPERADMIN: 4,
};

export const can = (role: UserRole, minimum: UserRole) => rank[role] >= rank[minimum];

export function assertTenantAccess(user: { role: UserRole; tenantId: string | null }, tenantId: string) {
  if (user.role === "SUPERADMIN") return;
  if (!user.tenantId || user.tenantId !== tenantId) throw new Error("FORBIDDEN");
}
