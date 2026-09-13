import fs from "fs";
import path from "path";
import YAML from "yaml";
import { app_config as bundled_config } from "./app";
import type { AppConfig, LocaleConfig } from "./app";

/**
 * Read the mounted config/app.config.yml fresh on every call, so self-hosted
 * edits take effect on the next request — no rebuild and no container restart
 * required (a plain `docker compose up -d` is enough for a fresh install).
 * Falls back to the config compiled into the image when the file is missing
 * or invalid.
 *
 * Import this from server components / route handlers only — Node's `fs` and
 * the YAML parser are unavailable in the browser bundle.
 */

const APP_CONFIG_YAML = path.join(process.cwd(), "config", "app.config.yml");

function parseAppConfigYaml(raw: string): AppConfig | null {
  try {
    const parsed = YAML.parse(raw) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== "object") return null;

    const general = parsed.general as
      | { username?: unknown; email?: unknown }
      | undefined;
    if (!general || typeof general !== "object") return null;
    if (
      typeof general.username !== "string" ||
      typeof general.email !== "string"
    ) {
      return null;
    }

    const result: AppConfig = {
      ...(bundled_config as AppConfig),
      general: { username: general.username, email: general.email },
    };

    for (const [key, value] of Object.entries(parsed)) {
      if (key === "general") continue;
      const locale = value as { name?: unknown; desc?: unknown } | null;
      if (locale && typeof locale === "object") {
        if (typeof locale.name === "string") {
          (result as Record<string, LocaleConfig>)[key] = {
            name: locale.name,
            desc: typeof locale.desc === "string" ? locale.desc : "",
          };
        }
      }
    }

    return result;
  } catch {
    return null;
  }
}

export function get_app_config(): AppConfig {
  try {
    const raw = fs.readFileSync(APP_CONFIG_YAML, "utf8");
    if (!raw.trim()) return bundled_config;
    return parseAppConfigYaml(raw) ?? bundled_config;
  } catch {
    return bundled_config;
  }
}