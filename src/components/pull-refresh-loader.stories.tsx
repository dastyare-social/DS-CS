import type { Meta, StoryObj } from "@storybook/react-vite";

import PullRefreshLoader from "@/components/pull-refresh-loader";

const meta = {
  title: "Design System/PullRefreshLoader",
  component: PullRefreshLoader,
  tags: ["autodocs"],
  args: {
    loaderHeight: 48,
    pullOpacity: 1,
    isRefreshing: false,
    clampedPull: 60,
  },
  argTypes: {
    loaderHeight: { control: { type: "number", min: 0, max: 120 } },
    pullOpacity: { control: { type: "number", min: 0, max: 1, step: 0.05 } },
    isRefreshing: { control: "boolean" },
    clampedPull: { control: { type: "number", min: 0, max: 200 } },
  },
} satisfies Meta<typeof PullRefreshLoader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {
  args: {
    loaderHeight: 0,
    pullOpacity: 0,
    clampedPull: 0,
  },
};

export const Pulling: Story = {
  args: {
    loaderHeight: 32,
    pullOpacity: 0.6,
    clampedPull: 30,
  },
};

export const PullingPastThreshold: Story = {
  args: {
    loaderHeight: 56,
    pullOpacity: 1,
    clampedPull: 90,
  },
};

export const Refreshing: Story = {
  args: {
    loaderHeight: 56,
    pullOpacity: 1,
    clampedPull: 100,
    isRefreshing: true,
  },
};