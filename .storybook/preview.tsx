import type { Preview } from "@storybook/react";
import { NextIntlClientProvider } from "next-intl";

import "@/styles/globals.css";
import "./preview.css";

const messages = {
  general: {
    new_posts: "New Posts",
    pinned_post: "Pinned Post",
  },
  not_found: {
    back_to_home: "Get Back To Home Page",
  },
};

const preview: Preview = {
  decorators: [
    (Story) => (
      <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
        <Story />
      </NextIntlClientProvider>
    ),
  ],
  parameters: {
    layout: "centered",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: "app",
      values: [
        { name: "app", value: "oklch(0.99 0 0)" },
        { name: "white", value: "#ffffff" },
      ],
    },
  },
};

export default preview;