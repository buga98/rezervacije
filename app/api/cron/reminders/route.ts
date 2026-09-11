import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendNotificationJob } from "@/lib/notifications/send";

export async function POST(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const jobs = await prisma.notificationJob.findMany({ where: { status: "PENDING", sendAt: { lte: new Date() } }, orderBy: { sendAt: "asc" }, take: 100 });
  for (const job of jobs) await sendNotificationJob(job.id);
  return NextResponse.json({ processed: jobs.length });
}
