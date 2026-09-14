import path from "node:path";

import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-a11y"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  viteFinal: async (viteConfig) => {
    viteConfig.resolve = viteConfig.resolve ?? {};
    const storybookMocks = path.resolve(process.cwd(), ".storybook/mocks");

    viteConfig.resolve.alias = {
      ...viteConfig.resolve.alias,
      "@": path.resolve(process.cwd(), "src"),
      // Real next/navigation + next/image pull Next internals that aren't
      // available in the SB iframe; stories use lightweight mocks instead.
      "next/navigation": path.join(storybookMocks, "next-navigation.ts"),
      "next/image": path.join(storybookMocks, "next-image.tsx"),
      // next/font/local downloads/hashes fonts via Next internals; the mock
      // returns real classes backed by the Pally @font-face in preview.css.
      "next/font/local": path.join(storybookMocks, "next-font-local.ts"),
    };

    viteConfig.plugins = [
      ...(viteConfig.plugins ?? []),
      tailwindcss(),
      // @storybook/react-vite only registers docgen plugins, not the React
      // transform. Without it, rolldown-vite leaves React's CJS interop
      // un-wired and the preview iframe fails with "react does not provide an
      // export named 'default'".
      react(),
    ];

    return viteConfig;
  },
};

export default config;