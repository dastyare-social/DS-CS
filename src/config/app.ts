import client_config from "../../config/app.config.json";

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
 * Bundle-safe app config (compiled into the prebuilt image and into client
 * bundles). Server components that want the mounted/edited config at runtime
 * (config/app.config.yml via generate:config) should import the server-only
 * get_app_config() from "@/config/runtime" instead.
 */
export const app_config: AppConfig = client_config;

export const app_url = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:8729";
