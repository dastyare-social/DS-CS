import resume_config_json from "../../config/resume.config.json";

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

export const resume_config: ResumeConfig = resume_config_json;

/** The page only exists when explicitly enabled and a name is configured. */
export const is_resume_enabled =
  resume_config.enabled === true && Boolean(resume_config.general?.name);
