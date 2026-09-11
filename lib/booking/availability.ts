import { addMinutes } from "date-fns";
import { prisma } from "@/lib/db";
import { minutesToDate, overlaps, weekdayInZone } from "./time";

export type AvailableSlot = { start: string; startsAt: string; staffId: string; staffName: string };

type Args = { tenantId: string; date: string; serviceId: string; staffId?: string | null };

function intersectRanges(a: Array<[number, number]>, b: Array<[number, number]>) {
  const out: Array<[number, number]> = [];
  for (const [as, ae] of a) for (const [bs, be] of b) {
    const s = Math.max(as, bs); const e = Math.min(ae, be);
    if (s < e) out.push([s, e]);
  }
  return out;
}

export async function getAvailableSlots({ tenantId, date, serviceId, staffId }: Args): Promise<AvailableSlot[]> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant || !tenant.allowOnlineBooking) return [];
  const service = await prisma.service.findFirst({ where: { id: serviceId, tenantId, active: true, onlineBookable: true } });
  if (!service) return [];

  const weekday = weekdayInZone(date, tenant.timezone);
  const dayStart = minutesToDate(date, 0, tenant.timezone);
  const dayEnd = minutesToDate(date, 24 * 60, tenant.timezone);

  const staff = await prisma.staffProfile.findMany({
    where: {
      tenantId,
      bookable: true,
      ...(staffId ? { id: staffId } : {}),
      services: { some: { serviceId } },
    },
    include: {
      user: { select: { active: true } },
      workingHours: { where: { weekday, active: true } },
      breaks: { where: { weekday, active: true } },
      services: { where: { serviceId } },
    },
    orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }],
  });

  const tenantHours = await prisma.workingHour.findMany({ where: { tenantId, staffId: null, weekday, active: true } });
  const overrides = await prisma.scheduleOverride.findMany({
    where: { tenantId, startsAt: { lt: dayEnd }, endsAt: { gt: dayStart } },
  });
  const appointments = await prisma.appointment.findMany({
    where: {
      tenantId,
      startsAt: { lt: dayEnd },
      lockEndsAt: { gt: dayStart },
      status: { in: ["PENDING", "CONFIRMED"] },
      staffId: { in: staff.map(s => s.id) },
    },
    select: { staffId: true, lockStartsAt: true, lockEndsAt: true },
  });

  const byTime = new Map<string, AvailableSlot>();
  for (const member of staff) {
    if (!member.user.active) continue;
    const mapping = member.services[0];
    const serviceDuration = mapping?.customDurationMin ?? service.durationMin;
    const totalBefore = service.prepMin;
    const totalAfter = service.cleanupMin;

    const salonRanges = tenantHours.map(h => [h.startMin, h.endMin] as [number, number]);
    const memberRanges = member.workingHours.length
      ? member.workingHours.map(h => [h.startMin, h.endMin] as [number, number])
      : salonRanges;
    let ranges = member.workingHours.length ? intersectRanges(salonRanges, memberRanges) : salonRanges;

    const blocked = overrides.filter(o => (!o.staffId || o.staffId === member.id) && o.type === "BLOCKED");
    const workingOverride = overrides.filter(o => (!o.staffId || o.staffId === member.id) && o.type === "WORKING");
    if (workingOverride.length) {
      ranges = workingOverride.map(o => {
        const s = new Date(o.startsAt).toLocaleTimeString("en-GB", { timeZone: tenant.timezone, hour: "2-digit", minute: "2-digit" });
        const e = new Date(o.endsAt).toLocaleTimeString("en-GB", { timeZone: tenant.timezone, hour: "2-digit", minute: "2-digit" });
        const toMin = (x: string) => Number(x.slice(0, 2)) * 60 + Number(x.slice(3, 5));
        return [toMin(s), toMin(e)] as [number, number];
      });
    }

    for (const [open, close] of ranges) {
      for (let startMin = open + totalBefore; startMin + serviceDuration + totalAfter <= close; startMin += tenant.slotStepMinutes) {
        const startsAt = minutesToDate(date, startMin, tenant.timezone);
        const endsAt = addMinutes(startsAt, serviceDuration);
        const lockStart = addMinutes(startsAt, -totalBefore);
        const lockEnd = addMinutes(endsAt, totalAfter);
        const now = new Date();
        if (startsAt <= now) continue;

        const breakHit = member.breaks.some(b => {
          const bs = minutesToDate(date, b.startMin, tenant.timezone);
          const be = minutesToDate(date, b.endMin, tenant.timezone);
          return overlaps(lockStart, lockEnd, bs, be);
        });
        const overrideHit = blocked.some(o => overlaps(lockStart, lockEnd, o.startsAt, o.endsAt));
        const appointmentHit = appointments.some(a => a.staffId === member.id && overlaps(lockStart, lockEnd, a.lockStartsAt, a.lockEndsAt));
        if (breakHit || overrideHit || appointmentHit) continue;

        const label = new Intl.DateTimeFormat("hr-HR", { timeZone: tenant.timezone, hour: "2-digit", minute: "2-digit" }).format(startsAt);
        const slot = { start: label, startsAt: startsAt.toISOString(), staffId: member.id, staffName: member.displayName };
        if (!byTime.has(slot.startsAt)) byTime.set(slot.startsAt, slot);
      }
    }
  }

  return [...byTime.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
