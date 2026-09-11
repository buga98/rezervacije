import crypto from "node:crypto";
import { addMinutes, subHours } from "date-fns";
import { prisma } from "@/lib/db";
import { getAvailableSlots } from "./availability";
import { queueAppointmentNotifications } from "@/lib/notifications/queue";

const LOCK_QUANTUM_MIN = 5;
const hash = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

export type CreateAppointmentInput = {
  tenantId: string;
  serviceId: string;
  staffId?: string | null;
  startsAt: string;
  customer: { name: string; phone: string; email?: string | null; note?: string | null };
  source?: "ONLINE" | "WALK_IN" | "ADMIN";
};

export async function createAppointment(input: CreateAppointmentInput) {
  const tenant = await prisma.tenant.findUnique({ where: { id: input.tenantId } });
  if (!tenant) throw new Error("TENANT_NOT_FOUND");
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: tenant.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(input.startsAt));
  const available = await getAvailableSlots({ tenantId: input.tenantId, date, serviceId: input.serviceId, staffId: input.staffId });
  const exact = available.find(s => s.startsAt === input.startsAt && (!input.staffId || s.staffId === input.staffId));
  if (!exact) throw new Error("SLOT_UNAVAILABLE");

  const service = await prisma.service.findFirstOrThrow({ where: { id: input.serviceId, tenantId: input.tenantId } });
  const staffService = await prisma.staffService.findUnique({ where: { staffId_serviceId: { staffId: exact.staffId, serviceId: service.id } } });
  const duration = staffService?.customDurationMin ?? service.durationMin;
  const startsAt = new Date(input.startsAt);
  const endsAt = addMinutes(startsAt, duration);
  const lockStartsAt = addMinutes(startsAt, -service.prepMin);
  const lockEndsAt = addMinutes(endsAt, service.cleanupMin);
  const priceCents = staffService?.customPriceCents ?? service.priceCents;
  const manageToken = crypto.randomBytes(32).toString("base64url");

  try {
    const appointment = await prisma.$transaction(async tx => {
      const customer = await tx.customer.upsert({
        where: { tenantId_phone: { tenantId: input.tenantId, phone: input.customer.phone } },
        create: { tenantId: input.tenantId, name: input.customer.name, phone: input.customer.phone, email: input.customer.email || null, notes: input.customer.note || null },
        update: { name: input.customer.name, email: input.customer.email || undefined },
      });
      if (customer.blocked) throw new Error("CUSTOMER_BLOCKED");

      const created = await tx.appointment.create({
        data: {
          tenantId: input.tenantId,
          serviceId: service.id,
          staffId: exact.staffId,
          customerId: customer.id,
          source: input.source || "ONLINE",
          status: tenant.requireDeposit ? "PENDING" : "CONFIRMED",
          startsAt,
          endsAt,
          lockStartsAt,
          lockEndsAt,
          priceCents,
          depositCents: tenant.requireDeposit ? Math.round(priceCents * tenant.depositPercent / 100) : 0,
          notes: input.customer.note || null,
          manageTokenHash: hash(manageToken),
        },
      });

      const locks: Array<{ tenantId: string; staffId: string; appointmentId: string; startsAt: Date }> = [];
      for (let cursor = new Date(lockStartsAt); cursor < lockEndsAt; cursor = addMinutes(cursor, LOCK_QUANTUM_MIN)) {
        locks.push({ tenantId: input.tenantId, staffId: exact.staffId, appointmentId: created.id, startsAt: cursor });
      }
      await tx.appointmentSlotLock.createMany({ data: locks });
      return created;
    }, { isolationLevel: "Serializable", maxWait: 5000, timeout: 10000 });

    await queueAppointmentNotifications(appointment.id, manageToken);
    return { appointment, manageToken };
  } catch (error: any) {
    if (error?.code === "P2002") throw new Error("SLOT_TAKEN_RACE");
    throw error;
  }
}

export async function cancelAppointmentByToken(appointmentId: string, token: string) {
  const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId }, include: { tenant: true } });
  if (!appointment || appointment.manageTokenHash !== hash(token)) throw new Error("INVALID_TOKEN");
  const cutoff = subHours(appointment.startsAt, appointment.tenant.cancellationHours);
  if (new Date() > cutoff) throw new Error("CANCELLATION_WINDOW_CLOSED");
  return prisma.$transaction(async tx => {
    const updated = await tx.appointment.update({ where: { id: appointment.id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
    await tx.appointmentSlotLock.deleteMany({ where: { appointmentId: appointment.id } });
    await tx.notificationJob.updateMany({ where: { appointmentId: appointment.id, status: "PENDING" }, data: { status: "SKIPPED" } });
    return updated;
  });
}
