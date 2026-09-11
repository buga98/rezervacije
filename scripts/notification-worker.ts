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

  for (const job of jobs) {
    await sendNotificationJob(job.id);
  }
}

async function main() {
  console.log("[worker] notification worker started");

  for (;;) {
    await tick().catch((error) => console.error("[worker]", error));
    await sleep(15_000);
  }
}

main().catch((error) => {
  console.error("[worker] fatal", error);
  process.exit(1);
});
