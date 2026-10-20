import path from "node:path";

/**
 * Zernio publishes these six skills as Agent Skills Markdown documents
 * (`https://zernio.com/.well-known/agent-skills/<name>.md`). They are vendored
 * under `skills/zernio/` so both the DS-CS skills registry and the Mastra agent
 * read the same files — there is no second copy to drift.
 */
export const ZERNIO_SKILL_NAMES = [
  "schedule-post",
  "connect-account",
  "list-analytics",
  "send-message",
  "run-ads",
  "manage-blog-articles",
] as const;

export type ZernioSkillName = (typeof ZERNIO_SKILL_NAMES)[number];

/**
 * Paths are absolute because Mastra's `LocalSkillSource` resolves them against
 * the process working directory. In a bundled deployment the `skills/`
 * directory must be included in the build output.
 */
export const zernioSkills: string[] = ZERNIO_SKILL_NAMES.map((name) =>
  path.join(process.cwd(), "skills", "zernio", name),
);
