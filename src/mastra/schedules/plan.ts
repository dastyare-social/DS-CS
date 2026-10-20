/**
 * Content scheduling helpers.
 *
 * This does not publish anything: it turns a cadence into dated slots and a
 * cron expression that the operator (or the agent-cron runner) can act on. The
 * platform scheduler remains the source of truth for what is actually queued.
 */

export interface PostingScheduleInput {
  timezone?: string;
  daysPerWeek?: number;
  publishTime?: string;
  platforms?: string[];
  weeks?: number;
  startDate?: string;
}

export interface PostingSlot {
  date: string;
  weekday: string;
  time: string;
  platform: string | null;
  format: "flagship" | "repurpose" | "community";
  ideaPrompt: string;
}

export interface PostingSchedule {
  timezone: string;
  cron: string;
  publishTime: string;
  weekdays: string[];
  slots: PostingSlot[];
  notes: string[];
}

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const PATTERNS: Record<number, number[]> = {
  1: [3],
  2: [2, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 4, 5],
  6: [1, 2, 3, 4, 5, 6],
  7: [1, 2, 3, 4, 5, 6, 7],
};

const FORMATS: PostingSlot["format"][] = [
  "flagship",
  "repurpose",
  "community",
];

const IDEA_PROMPTS: Record<PostingSlot["format"], string> = {
  flagship:
    "The longest-form piece of the week. One argument, fully made; everything else points back to it.",
  repurpose:
    "Take the flagship's argument and give it a native shape on this platform.",
  community:
    "Ask the audience something they can answer from experience; reply to every response.",
};

function clampInt(value: number | undefined, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value as number)));
}

function parseTime(value: string | undefined): { hour: number; minute: number } {
  if (!value) return { hour: 9, minute: 0 };
  const match = value.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!match) {
    throw new Error(`publishTime must be HH:MM (24-hour), got "${value}".`);
  }
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function assertTimezone(timezone: string): void {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
  } catch {
    throw new Error(`Unknown timezone "${timezone}". Use an IANA name such as Europe/Berlin.`);
  }
}

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function nextWeekday(from: Date, isoDay: number): Date {
  const current = from.getUTCDay() || 7;
  const delta = (isoDay - current + 7) % 7;
  return utcDate(
    from.getUTCFullYear(),
    from.getUTCMonth(),
    from.getUTCDate() + delta,
  );
}

function parseStart(value: string | undefined): Date {
  if (!value) {
    const now = new Date();
    return utcDate(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`startDate must be YYYY-MM-DD, got "${value}".`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || isoDate(parsed) !== value) {
    throw new Error(`startDate "${value}" is not a real date.`);
  }
  return parsed;
}

export function planPostingSchedule(
  input: PostingScheduleInput = {},
): PostingSchedule {
  const timezone = input.timezone?.trim() || "UTC";
  assertTimezone(timezone);

  const daysPerWeek = clampInt(input.daysPerWeek, 3, 1, 7);
  const weeks = clampInt(input.weeks, 4, 1, 12);
  const { hour, minute } = parseTime(input.publishTime);
  const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const pattern = PATTERNS[daysPerWeek]!;
  const platforms =
    input.platforms?.map((platform) => platform.trim()).filter(Boolean) ?? [];

  const start = parseStart(input.startDate);
  const anchor = nextWeekday(start, pattern[0]!);

  const slots: PostingSlot[] = [];
  for (let week = 0; week < weeks; week += 1) {
    for (const [index, isoDay] of pattern.entries()) {
      const offset = week * 7 + (isoDay - pattern[0]!);
      const date = utcDate(
        anchor.getUTCFullYear(),
        anchor.getUTCMonth(),
        anchor.getUTCDate() + offset,
      );
      const format = FORMATS[(week + index) % FORMATS.length]!;

      slots.push({
        date: isoDate(date),
        weekday: WEEKDAYS[date.getUTCDay()]!,
        time,
        platform: platforms.length
          ? platforms[(week + index) % platforms.length]!
          : null,
        format,
        ideaPrompt: IDEA_PROMPTS[format],
      });
    }
  }

  return {
    timezone,
    cron: `${minute} ${hour} * * ${pattern.join(",")}`,
    publishTime: time,
    weekdays: pattern.map((day) => WEEKDAYS[day % 7]!),
    slots,
    notes: [
      `Dates are calendar dates in ${timezone}. The cron expression is interpreted by the host scheduler's timezone — set that to ${timezone} or the slots will drift.`,
      "Flagship → repurpose → community is a rotation, not a rule: drop a slot rather than publish filler.",
      "This plans slots; it does not queue posts. Use the Zernio schedule-post skill for the actual publish.",
    ],
  };
}
