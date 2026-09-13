"use client";

import { createContext, useContext } from "react";
import { app_config } from "@/config/app";
import type { AppConfig } from "@/config/app";

/**
 * Deliver the runtime app config (read server-side from the mounted
 * config/app.config.yml) to client components. The provider is fed its value
 * by the root server layout, so the same plain data is used for server-side
 * rendering and client hydration — no hydration mismatch. Outside the provider
 * (e.g. component tests) it falls back to the config bundled with the image.
 */
const SiteConfigContext = createContext<AppConfig>(app_config);

export function SiteConfigProvider({
  value,
  children,
}: {
  value: AppConfig;
  children: React.ReactNode;
}) {
  return (
    <SiteConfigContext.Provider value={value}>
      {children}
    </SiteConfigContext.Provider>
  );
}

export function useSiteConfig(): AppConfig {
  return useContext(SiteConfigContext);
}