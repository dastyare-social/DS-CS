import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "@/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
} from "@/components/dialog";

const meta = {
  title: "Design System/Dialog",
  component: Dialog,
  tags: ["autodocs"],
  argTypes: {
    open: { control: false },
    defaultOpen: { control: false },
    onOpenChange: { control: false },
  },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { defaultOpen: true },
  render: (args) => (
    <Dialog {...args}>
      <DialogContent className="w-[90vw] max-w-sm rounded-3xl bg-background/90 p-6 backdrop-blur-2xl">
        <h2 className="text-lg font-semibold">Hello</h2>
        <p className="text-sm opacity-70">
          A lightweight dialog built on top of Radix primitives.
        </p>
      </DialogContent>
    </Dialog>
  ),
};

export const WithCloseButton: Story = {
  args: { defaultOpen: true },
  render: (args) => (
    <Dialog {...args}>
      <DialogContent
        showCloseButton
        className="w-[90vw] max-w-sm rounded-3xl bg-background/90 p-6 backdrop-blur-2xl"
      >
        <h2 className="text-lg font-semibold">Settings</h2>
        <p className="text-sm opacity-70">
          Dismiss with the close button in the top-right corner.
        </p>
      </DialogContent>
    </Dialog>
  ),
};

export const Controlled: Story = {
  args: { defaultOpen: true },
  render: (args) => (
    <Dialog {...args}>
      <DialogContent className="w-[90vw] max-w-sm rounded-3xl bg-background/90 p-6 backdrop-blur-2xl">
        <h2 className="text-lg font-semibold">Dismissible</h2>
        <p className="text-sm opacity-70 mb-2">
          Use DialogClose for an explicit close action.
        </p>
        <DialogClose asChild>
          <Button variant="primary">Close</Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  ),
};

export const TriggerFlow: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="primary">Open dialog</Button>
      </DialogTrigger>
      <DialogContent className="w-[90vw] max-w-sm rounded-3xl bg-background/90 p-6 backdrop-blur-2xl">
        <h2 className="text-lg font-semibold">Opened from a trigger</h2>
        <p className="text-sm opacity-70">
          Click the button again to toggle, or press Escape.
        </p>
      </DialogContent>
    </Dialog>
  ),
};