import nodemailer from "nodemailer";
import webpush from "web-push";
import { prisma } from "@/lib/db";

function mailer() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
}

export async function sendNotificationJob(id: string) {
  const job = await prisma.notificationJob.findUnique({ where: { id }, include: { appointment: true } });
  if (!job || job.status !== "PENDING") return;
  if (job.appointment && ["CANCELLED", "COMPLETED", "NO_SHOW"].includes(job.appointment.status) && job.kind.includes("REMINDER")) {
    await prisma.notificationJob.update({ where: { id }, data: { status: "SKIPPED" } });
    return;
  }
  try {
    const p = job.payload as any;
    if (job.channel === "EMAIL") {
      const transport = mailer();
      if (!transport || !job.recipient) throw new Error("SMTP_NOT_CONFIGURED");
      await transport.sendMail({
        from: process.env.SMTP_FROM,
        to: job.recipient,
        subject: p.subject || p.title,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto"><h2>${escapeHtml(p.title || "Obavijest")}</h2><p>${escapeHtml(p.text || "")}</p>${p.manageUrl ? `<p><a href="${p.manageUrl}" style="display:inline-block;padding:12px 18px;background:#16151c;color:white;border-radius:10px;text-decoration:none">Upravljaj terminom</a></p>` : ""}<p style="color:#777;font-size:12px">Linea+ Rezervacije</p></div>`,
      });
    } else if (job.channel === "PUSH") {
      const pub = process.env.VAPID_PUBLIC_KEY; const priv = process.env.VAPID_PRIVATE_KEY;
      if (!pub || !priv) throw new Error("VAPID_NOT_CONFIGURED");
      webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", pub, priv);
      const subscriptions = await prisma.pushSubscription.findMany({ where: { tenantId: job.tenantId } });
      await Promise.allSettled(subscriptions.map(async s => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(p));
        } catch (e: any) {
          if ([404, 410].includes(e?.statusCode)) await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
          else throw e;
        }
      }));
    } else {
      throw new Error(`${job.channel}_PROVIDER_NOT_CONFIGURED`);
    }
    await prisma.notificationJob.update({ where: { id }, data: { status: "SENT", sentAt: new Date(), attempts: { increment: 1 } } });
  } catch (error: any) {
    await prisma.notificationJob.update({ where: { id }, data: { status: "FAILED", attempts: { increment: 1 }, lastError: String(error?.message || error) } });
  }
}

const escapeHtml = (s: string) => s.replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]!));
