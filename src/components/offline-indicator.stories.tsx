import type { Meta, StoryObj } from "@storybook/react-vite";

import OfflineIndicator from "@/components/offline-indicator";

const meta = {
  title: "Design System/OfflineIndicator",
  component: OfflineIndicator,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof OfflineIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

// When the browser is online the component intentionally renders nothing —
// that's the expected resting state.
export const Online: Story = {};

export const Offline: Story = {
  play: async () => {
    window.dispatchEvent(new Event("offline"));
  },
  parameters: {
    description: {
      story:
        "Fires an `offline` window event (as the real navigation would) to render the sticky banner.",
    },
  },
};