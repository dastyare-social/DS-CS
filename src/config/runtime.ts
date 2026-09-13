import fs from "fs";
import path from "path";
import { app_config } from "./app";
import type { AppConfig } from "./app";

/**
 * Server-only app config loader. Reads the config/app.config.json that
 * scripts/generate-app-config.ts writes at container start from the mounted
 * config/app.config.yml, so self-hosted edits take effect after
 * `docker compose restart app`. Falls back to the bundled config.
 *
 * Import this from server components / route handlers only — Node's `fs` is
 * unavailable in the browser, so importing it into a client bundle is a build
 * error.
 */
export function get_app_config(): AppConfig {
  try {
    const config_path = path.join(process.cwd(), "config", "app.config.json");
    const parsed = JSON.parse(fs.readFileSync(config_path, "utf8")) as AppConfig;
    if (parsed.general?.username && parsed.general?.email) {
      return parsed;
    }
  } catch {
    // fall through to the bundled config
  }
  return app_config;
}