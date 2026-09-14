import type { Meta, StoryObj } from "@storybook/react-vite";

import { Input } from "@/components/input";

const meta = {
  title: "Design System/Input",
  component: Input,
  tags: ["autodocs"],
  argTypes: {
    className: { control: "text" },
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    type: "text",
    placeholder: "Type something…",
  },
};

export const Disabled: Story = {
  args: {
    type: "text",
    placeholder: "Type something…",
    disabled: true,
  },
};

export const WithLabel: Story = {
  render: (args) => (
    <label className="flex w-full max-w-xs flex-col gap-1.5">
      <span className="text-sm font-medium">Email</span>
      <Input {...args} />
    </label>
  ),
  args: {
    type: "email",
    placeholder: "you@example.com",
  },
};