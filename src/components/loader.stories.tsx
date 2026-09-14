import type { Meta, StoryObj } from "@storybook/react-vite";

import Loader from "@/components/loader";

const meta = {
  title: "Design System/Loader",
  component: Loader,
  tags: ["autodocs"],
  argTypes: {
    className: { control: "text" },
  },
} satisfies Meta<typeof Loader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Small: Story = {
  args: {
    className: "size-6 p-1",
  },
};

export const Large: Story = {
  args: {
    className: "size-16 p-3",
  },
};

export const OnPrimary: Story = {
  render: (args) => (
    <div className="flex items-center justify-center rounded-2xl bg-primary/10 p-8">
      <Loader {...args} />
    </div>
  ),
};