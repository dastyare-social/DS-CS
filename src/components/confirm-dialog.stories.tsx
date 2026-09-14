import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type ComponentProps } from "react";

import ConfirmDialog from "@/components/confirm-dialog";

function ControlledConfirmDialog(props: ComponentProps<typeof ConfirmDialog>) {
  const [open, setOpen] = useState(props.open ?? true);
  return (
    <ConfirmDialog
      {...props}
      open={open}
      onOpenChange={setOpen}
      onConfirm={() => setOpen(false)}
      onCancel={() => setOpen(false)}
    />
  );
}

const meta = {
  title: "Design System/ConfirmDialog",
  component: ConfirmDialog,
  tags: ["autodocs"],
  args: {
    open: true,
    title: "Are You Sure? —",
    description:
      "are you sure you wanna cancel — changes wouldn't apply if you accept it",
    confirmLabel: "Yes, Do It",
    cancelLabel: "No, I Don't",
    onOpenChange: () => undefined,
    onConfirm: () => undefined,
    onCancel: () => undefined,
  },
  argTypes: {
    open: { control: false },
    onOpenChange: { control: false },
    onConfirm: { control: false },
    onCancel: { control: false },
  },
} satisfies Meta<typeof ConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  render: (args) => <ControlledConfirmDialog {...args} />,
};