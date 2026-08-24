import fs from "fs";
import path from "path";
import YAML from "yaml";

export interface ResumeContact {
  label: string;
  value: string;
  href?: string;
}

export interface ResumeGeneral {
  name: string;
  avatar?: string;
  jobTitle?: string;
  website?: string;
  about?: string;
  contacts?: ResumeContact[];
}

export interface ResumeItem {
  title: string;
  subTitle?: string;
  date?: string;
  description?: string;
}

export interface ResumeSection {
  title: string;
  items: ResumeItem[];
}

export interface ResumeConfig {
  /** Must be the first key in resume.config.yml — true activates /resume. */
  enabled: boolean;
  general: ResumeGeneral;
  content?: ResumeSection[];
}

export const RESUME_CONFIG_PATH = path.join(
  process.cwd(),
  "config",
  "resume.config.yml"
);

const DISABLED_FALLBACK: ResumeConfig = { enabled: false, general: { name: "" } };

/** Parse + shape-check a raw YAML document. Returns null when invalid. */
export function parseResumeConfig(raw: string): ResumeConfig | null {
  try {
    const parsed = YAML.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.enabled !== "boolean") return null;
    if (!parsed.general || typeof parsed.general !== "object") return null;
    if (!parsed.general.name || typeof parsed.general.name !== "string")
      return null;
    if (
      parsed.content !== undefined &&
      (!Array.isArray(parsed.content) ||
        parsed.content.some(
          (section: unknown) =>
            !section ||
            typeof section !== "object" ||
            typeof (section as ResumeSection).title !== "string" ||
            !Array.isArray((section as ResumeSection).items)
        ))
    )
      return null;
    return parsed as ResumeConfig;
  } catch {
    return null;
  }
}

/** Read the raw YAML file, or null when missing/unreadable. */
export function readResumeYaml(): string | null {
  try {
    const raw = fs.readFileSync(RESUME_CONFIG_PATH, "utf8");
    return raw.trim() ? raw : null;
  } catch {
    return null;
  }
}

/**
 * Reads resume.config.yml fresh on every call so flipping `enabled` takes
 * effect on the next request — no rebuild or server restart required.
 * A missing or invalid file disables the page rather than crashing the app.
 */
export function getResumeConfig(): ResumeConfig {
  const raw = readResumeYaml();
  if (!raw) return DISABLED_FALLBACK;
  return parseResumeConfig(raw) ?? DISABLED_FALLBACK;
}

/** The page only exists when explicitly enabled and a name is configured. */
export function isResumeEnabled() {
  const config = getResumeConfig();
  return config.enabled === true && Boolean(config.general?.name);
}

/** Validate and write a full YAML document. Returns an error string or null. */
export function writeResumeYaml(raw: string): string | null {
  if (!raw.trim()) return "YAML content is empty";
  // `enabled` must stay the first key of the document.
  if (!/^enabled\s*:/.test(raw.trimStart()))
    return "The first key of resume.config.yml must be `enabled:`";
  if (!parseResumeConfig(raw))
    return "Invalid resume config — needs boolean `enabled`, a `general` object with a non-empty `name`, and optional array `content` sections with title/items";
  try {
    fs.writeFileSync(RESUME_CONFIG_PATH, raw.endsWith("\n") ? raw : `${raw}\n`);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : "Failed to write config file";
  }
}

/** Flip `enabled` while keeping it the first key and preserving all other data. */
export function setResumeEnabled(enabled: boolean): string | null {
  const raw = readResumeYaml();
  if (!raw) return enabled ? "resume.config.yml not found" : null;

  const parsed = YAML.parse(raw);
  if (!parsed || typeof parsed !== "object")
    return "Existing resume.config.yml is not a valid mapping";

  // Rebuild with `enabled` pinned first; YAML.stringify preserves key order.
  const ordered: Record<string, unknown> = { enabled };
  for (const [key, value] of Object.entries(parsed)) {
    if (key !== "enabled") ordered[key] = value;
  }

  return writeResumeYaml(YAML.stringify(ordered));
}
