import type { Meta, StoryObj } from "@storybook/react-vite";

import NotFoundGetBackHomeButton from "@/components/not-found-get-back-home-button";

const meta = {
  title: "Design System/NotFoundGetBackHomeButton",
  component: NotFoundGetBackHomeButton,
  tags: ["autodocs"],
} satisfies Meta<typeof NotFoundGetBackHomeButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};