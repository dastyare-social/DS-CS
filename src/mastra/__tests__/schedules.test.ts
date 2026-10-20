import { describe, expect, it } from "bun:test";

import { planPostingSchedule } from "../schedules/plan";
import {
  AGENT_CRON_JOBS,
  getAgentCronJob,
} from "../schedules/jobs";

describe("planPostingSchedule", () => {
  it("turns a three-day cadence into dated slots and a cron expression", () => {
    const schedule = planPostingSchedule({
      timezone: "Europe/Berlin",
      daysPerWeek: 3,
      publishTime: "09:30",
      weeks: 2,
      startDate: "2026-10-20",
      platforms: ["linkedin", "x", "instagram"],
    });

    expect(schedule.cron).toBe("30 9 * * 1,3,5");
    expect(schedule.weekdays).toEqual(["Monday", "Wednesday", "Friday"]);
    expect(schedule.slots).toHaveLength(6);
    expect(schedule.slots[0]?.date).toBe("2026-10-26");
    expect(schedule.slots[0]?.weekday).toBe("Monday");
    expect(schedule.slots[0]?.platform).toBe("linkedin");
    expect(schedule.slots[1]?.platform).toBe("x");
    expect(schedule.slots.map((slot) => slot.format)).toContain("flagship");
  });

  it("defaults to UTC and a Monday/Wednesday/Friday cadence", () => {
    const schedule = planPostingSchedule({ weeks: 1 });

    expect(schedule.timezone).toBe("UTC");
    expect(schedule.cron).toBe("0 9 * * 1,3,5");
    expect(schedule.slots).toHaveLength(3);
  });

  it("supports a daily cadence", () => {
    const schedule = planPostingSchedule({
      daysPerWeek: 7,
      weeks: 1,
      startDate: "2026-10-19",
    });

    expect(schedule.cron).toBe("0 9 * * 1,2,3,4,5,6,7");
    expect(schedule.slots).toHaveLength(7);
  });

  it("rejects an unknown timezone", () => {
    expect(() => planPostingSchedule({ timezone: "Mars/Olympus" })).toThrow(
      "Unknown timezone",
    );
  });

  it("rejects an impossible date", () => {
    expect(() =>
      planPostingSchedule({ startDate: "2026-02-30" }),
    ).toThrow("not a real date");
  });

  it("rejects a malformed publish time", () => {
    expect(() => planPostingSchedule({ publishTime: "9am" })).toThrow("HH:MM");
  });

  it("clamps the number of weeks", () => {
    const schedule = planPostingSchedule({ weeks: 99, daysPerWeek: 1 });
    expect(schedule.slots).toHaveLength(12);
  });
});

describe("agent cron jobs", () => {
  it("has unique ids and five-field cron expressions", () => {
    const ids = AGENT_CRON_JOBS.map((job) => job.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const job of AGENT_CRON_JOBS) {
      expect(job.cron.trim().split(/\s+/)).toHaveLength(5);
      expect(job.prompt.length).toBeGreaterThan(80);
    }
  });

  it("finds a job by id and rejects an unknown one", () => {
    expect(getAgentCronJob("weekly-content-plan")?.name).toBe(
      "Weekly content plan",
    );
    expect(getAgentCronJob("nope")).toBeUndefined();
  });
});
