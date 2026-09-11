import { subHours } from "date-fns";
import { prisma } from "@/lib/db";

export async function queueAppointmentNotifications(appointmentId: string, manageToken?: string) {
  const a = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      tenant: { include: { users: { where: { active: true, role: { in: ["OWNER", "MANAGER"] } } } } },
      customer: true,
      staff: true,
      service: true,
    },
  });
  if (!a) return;
  const appUrl = process.env.APP_URL || "http://localhost:3700";
  const when = new Intl.DateTimeFormat("hr-HR", {
    timeZone: a.tenant.timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(a.startsAt);
  const manageUrl = manageToken ? `${appUrl}/manage/${a.id}?token=${encodeURIComponent(manageToken)}` : undefined;

  const jobs: any[] = [];
  if (a.customer.email) {
    jobs.push({
      tenantId: a.tenantId,
      appointmentId: a.id,
      channel: "EMAIL",
      kind: "CUSTOMER_CONFIRMATION",
      recipient: a.customer.email,
      sendAt: new Date(),
      payload: { subject: `Potvrda termina – ${a.tenant.name}`, title: "Termin je potvrđen", text: `${a.service.name}, ${when}`, manageUrl },
    });
  }

  for (const owner of a.tenant.users) {
    jobs.push({
      tenantId: a.tenantId,
      appointmentId: a.id,
      channel: "EMAIL",
      kind: "ADMIN_NEW_APPOINTMENT",
      recipient: owner.email,
      sendAt: new Date(),
      payload: { subject: `Novi termin – ${a.customer.name}`, title: "Nova rezervacija", text: `${a.customer.name} • ${a.service.name} • ${when}` },
    });
  }
  jobs.push({
    tenantId: a.tenantId,
    appointmentId: a.id,
    channel: "PUSH",
    kind: "ADMIN_NEW_APPOINTMENT",
    recipient: null,
    sendAt: new Date(),
    payload: { title: `Nova rezervacija: ${a.customer.name}`, body: `${a.service.name} • ${when}`, url: "/dashboard/calendar" },
  });

  const reminderHours = Array.isArray(a.tenant.defaultReminderHours) ? a.tenant.defaultReminderHours : [24, 2];
  for (const h of reminderHours as number[]) {
    const sendAt = subHours(a.startsAt, Number(h));
    if (sendAt <= new Date()) continue;
    if (a.customer.email) jobs.push({
      tenantId: a.tenantId,
      appointmentId: a.id,
      channel: "EMAIL",
      kind: `CUSTOMER_REMINDER_${h}H`,
      recipient: a.customer.email,
      sendAt,
      payload: { subject: `Podsjetnik za termin – ${a.tenant.name}`, title: `Podsjetnik: termin za ${h} h`, text: `${a.service.name}, ${when}`, manageUrl },
    });
  }

  if (jobs.length) await prisma.notificationJob.createMany({ data: jobs });
}

export async function queueCancellationNotifications(appointmentId: string) {
  const a = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { tenant: { include: { users: { where: { active: true, role: { in: ["OWNER", "MANAGER"] } } } } }, customer: true, service: true },
  });
  if (!a) return;
  const when = new Intl.DateTimeFormat("hr-HR", { timeZone: a.tenant.timezone, dateStyle: "medium", timeStyle: "short" }).format(a.startsAt);
  const rows: any[] = [];
  if (a.customer.email) rows.push({ tenantId: a.tenantId, appointmentId: a.id, channel: "EMAIL", kind: "CUSTOMER_CANCELLED", recipient: a.customer.email, sendAt: new Date(), payload: { subject: `Termin otkazan – ${a.tenant.name}`, title: "Termin je otkazan", text: `${a.service.name}, ${when}` } });
  for (const user of a.tenant.users) rows.push({ tenantId: a.tenantId, appointmentId: a.id, channel: "EMAIL", kind: "ADMIN_CANCELLED", recipient: user.email, sendAt: new Date(), payload: { subject: `Otkazan termin – ${a.customer.name}`, title: "Klijent je otkazao termin", text: `${a.customer.name} • ${a.service.name} • ${when}` } });
  rows.push({ tenantId: a.tenantId, appointmentId: a.id, channel: "PUSH", kind: "ADMIN_CANCELLED", recipient: null, sendAt: new Date(), payload: { title: "Termin je otkazan", body: `${a.customer.name} • ${a.service.name} • ${when}`, url: "/dashboard/calendar" } });
  await prisma.notificationJob.createMany({ data: rows });
}
