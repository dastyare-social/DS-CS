import client_config from "../../config/app.config.json";

export interface AppConfig {
  general: {
    username: string;
    email: string;
  };

  en: {
    name: string;
    desc: string;
  };
}

export const app_config: AppConfig = client_config;

export const app_url = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:8729";
