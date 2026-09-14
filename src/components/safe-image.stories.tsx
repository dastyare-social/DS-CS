import type { Meta, StoryObj } from "@storybook/react-vite";

import SafeImage from "@/components/safe-image";

const meta = {
  title: "Design System/SafeImage",
  component: SafeImage,
  tags: ["autodocs"],
  args: {
    src: "https://picsum.photos/id/1018/800/600",
    alt: "A mountain lake",
    width: 800,
    height: 600,
    unoptimized: true,
  },
  argTypes: {
    src: { control: "text" },
    alt: { control: "text" },
    className: { control: "text" },
  },
} satisfies Meta<typeof SafeImage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loaded: Story = {};

export const WithFill: Story = {
  render: () => (
    <div className="relative h-56 w-72 overflow-hidden rounded-2xl border border-secondary/5">
      <SafeImage
        src="https://picsum.photos/id/1018/800/600"
        alt="A mountain lake"
        fill
        sizes="320px"
        unoptimized
        className="object-cover"
      />
    </div>
  ),
};

export const BrokenImageFallback: Story = {
  args: {
    src: "https://example.com/definitely-missing.jpg",
    alt: "Broken image",
  },
  render: (args) => (
    <div className="grid h-56 w-72 place-items-center rounded-2xl border border-secondary/5 bg-white/40">
      <SafeImage {...args} />
    </div>
  ),
};