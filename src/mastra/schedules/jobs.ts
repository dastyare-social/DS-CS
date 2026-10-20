/**
 * Agent cron jobs.
 *
 * These are definitions, not a scheduler: the app has no long-lived worker, so
 * the host runs them (`bun run agent:cron -- --job <id>`) from crontab, a
 * Kubernetes CronJob or the platform's scheduler. Keeping the prompts in code
 * means a job can be reviewed and tested like any other prompt.
 *
 * Times are written for a server in the operator's timezone; pass the same
 * timezone to the host scheduler.
 */

export interface AgentCronJob {
  id: string;
  name: string;
  /** Standard five-field cron expression. */
  cron: string;
  description: string;
  prompt: string;
}

export const AGENT_CRON_JOBS: readonly AgentCronJob[] = [
  {
    id: "weekly-content-plan",
    name: "Weekly content plan",
    cron: "0 8 * * 1",
    description: "Monday morning plan for the week: themes, slots and owners.",
    prompt:
      "Produce this week's content plan for the channel. Read the last 30 posts with list_channel_posts, identify the three strongest themes, and return four to six slots. For each slot give the working title, the platform, the source material and which specialist should draft it. Do not write the posts.",
  },
  {
    id: "daily-analytics-digest",
    name: "Daily analytics digest",
    cron: "0 7 * * *",
    description: "Morning summary of what moved on the channel in the last day.",
    prompt:
      "Summarise this channel's performance for the last 24 hours. Use list_channel_posts and channel_stats, compare against the preceding week, and return three observations with the numbers behind them. Say explicitly when the data cannot answer a question.",
  },
  {
    id: "weekly-repurpose",
    name: "Weekly repurpose",
    cron: "0 10 * * 4",
    description: "Thursday: turn the week's strongest post into the full format set.",
    prompt:
      "Pick the strongest post from the last seven days that has not already been repurposed. Call repurpose_post for it, then produce the full multi-format set (X post, X thread, LinkedIn, Instagram, Reddit, newsletter, short-video script) following the returned playbook. Keep every fact from the source.",
  },
  {
    id: "monthly-newsletter",
    name: "Monthly newsletter",
    cron: "0 9 1 * *",
    description: "First of the month: draft the email issue from the month's posts.",
    prompt:
      "Draft this month's email newsletter from the strongest posts of the last 30 days. Return three subject-line options, preview text, the body, and exactly one call to action. Do not invent links or statistics that are not in the source posts.",
  },
];

export function getAgentCronJob(id: string): AgentCronJob | undefined {
  return AGENT_CRON_JOBS.find((job) => job.id === id);
}
