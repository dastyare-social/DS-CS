import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { planPostingSchedule } from "../schedules/plan";

export const planPostingScheduleTool = createTool({
  id: "plan_posting_schedule",
  description:
    "Turn a posting cadence into dated slots and a cron expression: weekdays, publish time, platform rotation and flagship/repurpose/community format. Plans the schedule only; it does not queue or publish posts.",
  inputSchema: z.object({
    timezone: z
      .string()
      .optional()
      .describe("IANA timezone, e.g. Europe/Berlin. Defaults to UTC."),
    daysPerWeek: z
      .number()
      .int()
      .min(1)
      .max(7)
      .optional()
      .describe("Posting days per week, default 3 (Mon/Wed/Fri)."),
    publishTime: z
      .string()
      .optional()
      .describe("Local publish time as HH:MM (24-hour), default 09:00."),
    platforms: z
      .array(z.string())
      .optional()
      .describe("Platforms to rotate through, in order."),
    weeks: z
      .number()
      .int()
      .min(1)
      .max(12)
      .optional()
      .describe("How many weeks to plan, default 4."),
    startDate: z
      .string()
      .optional()
      .describe("First date to consider, YYYY-MM-DD. Defaults to today (UTC)."),
  }),
  outputSchema: z.object({
    timezone: z.string(),
    cron: z.string(),
    publishTime: z.string(),
    weekdays: z.array(z.string()),
    slots: z.array(
      z.object({
        date: z.string(),
        weekday: z.string(),
        time: z.string(),
        platform: z.string().nullable(),
        format: z.enum(["flagship", "repurpose", "community"]),
        ideaPrompt: z.string(),
      }),
    ),
    notes: z.array(z.string()),
  }),
  execute: async ({
    timezone,
    daysPerWeek,
    publishTime,
    platforms,
    weeks,
    startDate,
  }) => {
    return planPostingSchedule({
      timezone,
      daysPerWeek,
      publishTime,
      platforms,
      weeks,
      startDate,
    });
  },
});

export const scheduleTools = {
  plan_posting_schedule: planPostingScheduleTool,
};
