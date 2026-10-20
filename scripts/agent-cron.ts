import "dotenv/config";

import {
  AGENT_CRON_JOBS,
  getAgentCronJob,
} from "../src/mastra/schedules/jobs";

/**
 * Runs one agent cron job, or lists the available jobs.
 *
 * The app has no long-lived scheduler, so this is meant to be invoked by the
 * host: crontab, a Kubernetes CronJob, or the platform's scheduler.
 *
 *   bun run agent:cron -- --list
 *   bun run agent:cron -- --job daily-analytics-digest
 *
 * The job definitions live in `src/mastra/schedules/jobs.ts`, so adding a job
 * is a code change that can be reviewed and tested.
 */
function printJobs(): void {
  console.log("Available agent cron jobs:\n");
  for (const job of AGENT_CRON_JOBS) {
    console.log(`  ${job.id}`);
    console.log(`    cron:        ${job.cron}`);
    console.log(`    name:        ${job.name}`);
    console.log(`    description: ${job.description}\n`);
  }
  console.log(
    "Run one with: bun run agent:cron -- --job <id>\nSet the host scheduler's timezone to match the channel.",
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const jobFlag = args.indexOf("--job");

  if (jobFlag === -1 || args.includes("--list") || args.includes("--help")) {
    printJobs();
    return;
  }

  const jobId = args[jobFlag + 1];
  const job = jobId ? getAgentCronJob(jobId) : undefined;

  if (!job) {
    console.error(
      `Unknown job "${jobId ?? ""}". Available: ${AGENT_CRON_JOBS.map((item) => item.id).join(", ")}`,
    );
    process.exitCode = 1;
    return;
  }

  const [{ mastra }, { zernioMemory, zernioMemoryContext }] = await Promise.all([
    import("../src/mastra"),
    import("../src/mastra/memory"),
  ]);

  const agent = mastra.getAgent("zernio");
  const memory = zernioMemory();
  const options = memory
    ? { memory: zernioMemoryContext("system", `cron-${job.id}`) }
    : {};

  console.log(`Running ${job.id} (${job.cron})…\n`);

  const result = await agent.generate(job.prompt, options);
  console.log(result.text);

  const tokens = result.usage?.totalTokens;
  if (typeof tokens === "number") {
    console.log(`\n[${tokens} tokens]`);
  }
}

main().catch((error) => {
  console.error(
    `Agent cron job failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
