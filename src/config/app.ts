import fs from "fs";
import path from "path";
import bundled_config from "../../config/app.config.json";

export interface LocaleConfig {
  name: string;
  desc: string;
}

export interface AppConfig {
  general: {
    username: string;
    email: string;
  };

  en: LocaleConfig;

  [locale: string]: LocaleConfig | { username: string; email: string };
}

/**
 * Load the app config from the JSON generated at startup
 * (scripts/generate-app-config.ts reads config/app.config.yml). Reading it from
 * disk at runtime means a mounted/edited app.config.yml takes effect after the
 * container (re)starts, instead of being stuck to the value baked into the
 * prebuilt image. Falls back to the bundled JSON if the file is missing.
 */
function load_config(): AppConfig {
  try {
    const config_path = path.join(process.cwd(), "config", "app.config.json");
    const raw = fs.readFileSync(config_path, "utf8");
    const parsed = JSON.parse(raw) as AppConfig;
    if (parsed.general?.username && parsed.general?.email) {
      return parsed;
    }
  } catch {
    // fall through to the bundled config
  }
  return bundled_config as AppConfig;
}

export const app_config: AppConfig = load_config();

export const app_url = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:8729";
