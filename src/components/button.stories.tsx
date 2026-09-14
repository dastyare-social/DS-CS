import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "@/components/button";

const meta = {
  title: "Design System/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: { control: "select", options: ["primary", "secondary"] },
    asChild: { control: false },
    className: { control: "text" },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    children: "Button",
    variant: "primary",
  },
};

export const Secondary: Story = {
  args: {
    children: "Button",
    variant: "secondary",
  },
};

export const Disabled: Story = {
  args: {
    children: "Button",
    disabled: true,
  },
};

export const AsChildLink: Story = {
  render: (args) => (
    <Button {...args} asChild>
      <a href="#">
        <span className="underline">Link</span>
      </a>
    </Button>
  ),
  argTypes: {
    asChild: { control: false },
  },
};

export const VariantsMatrix: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-4">
      <Button {...args} variant="primary">
        Primary
      </Button>
      <Button {...args} variant="secondary">
        Secondary
      </Button>
      <Button {...args} variant="primary" disabled>
        Primary disabled
      </Button>
      <Button {...args} variant="secondary" disabled>
        Secondary disabled
      </Button>
    </div>
  ),
};