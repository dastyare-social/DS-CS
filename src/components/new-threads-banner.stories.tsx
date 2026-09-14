import type { Meta, StoryObj } from "@storybook/react-vite";

import NewThreadsBanner from "@/components/new-threads-banner";

const meta = {
  title: "Design System/NewThreadsBanner",
  component: NewThreadsBanner,
  tags: ["autodocs"],
  args: {
    count: 3,
    isApplying: false,
    onClick: () => undefined,
  },
  argTypes: {
    count: { control: { type: "number", min: 0 } },
    isApplying: { control: "boolean" },
    onClick: { control: false },
  },
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof NewThreadsBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SeveralNew: Story = {};

export const Applying: Story = {
  args: {
    count: 5,
    isApplying: true,
  },
};

// count <= 1 → the component returns null by design
export const SingleNew: Story = {
  args: {
    count: 1,
  },
};