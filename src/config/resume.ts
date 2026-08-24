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

const RESUME_CONFIG_PATH = path.join(process.cwd(), "config", "resume.config.yml");

const DISABLED_FALLBACK: ResumeConfig = { enabled: false, general: { name: "" } };

/**
 * Reads resume.config.yml fresh on every call so flipping `enabled` takes
 * effect on the next request — no rebuild or server restart required.
 * A missing or invalid file disables the page rather than crashing the app.
 */
export const getResumeConfig = (): ResumeConfig => {
  try {
    const parsed = YAML.parse(fs.readFileSync(RESUME_CONFIG_PATH, "utf8"));
    if (!parsed || typeof parsed !== "object" || !parsed.general?.name) {
      return DISABLED_FALLBACK;
    }
    return parsed as ResumeConfig;
  } catch {
    return DISABLED_FALLBACK;
  }
};

/** The page only exists when explicitly enabled and a name is configured. */
export const isResumeEnabled = () => {
  const config = getResumeConfig();
  return config.enabled === true && Boolean(config.general?.name);
};
