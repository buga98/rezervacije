import "dotenv/config";
import { prisma } from "../lib/db";
import { sendNotificationJob } from "../lib/notifications/send";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function tick() {
  const jobs = await prisma.notificationJob.findMany({
    where: { status: "PENDING", sendAt: { lte: new Date() } },
    orderBy: { sendAt: "asc" },
    take: 50,
  });
  for (const job of jobs) await sendNotificationJob(job.id);
}

console.log("[worker] notification worker started");
for (;;) {
  await tick().catch(e => console.error("[worker]", e));
  await sleep(15_000);
}
