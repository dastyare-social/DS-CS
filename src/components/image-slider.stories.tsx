import type { Meta, StoryObj } from "@storybook/react-vite";

import ImageSlider from "@/components/image-slider";

const gradientSvg = (from: string, to: string, label: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'>` +
      `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
      `<stop offset='0' stop-color='${from}'/><stop offset='1' stop-color='${to}'/>` +
      `</linearGradient></defs>` +
      `<rect width='800' height='600' fill='url(#g)'/>` +
      `<text x='400' y='300' font-family='monospace' font-size='56' fill='rgba(255,255,255,0.92)' text-anchor='middle' dominant-baseline='middle'>${label}</text>` +
      `</svg>`,
  )}`;

const meta = {
  title: "Design System/ImageSlider",
  component: ImageSlider,
  tags: ["autodocs"],
  argTypes: {
    content: { control: "text" },
  },
} satisfies Meta<typeof ImageSlider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleImage: Story = {
  args: {
    media: [
      {
        url: gradientSvg("#f97316", "#ef4444", "One"),
        width: 800,
        height: 600,
      },
    ],
    content: "A single slide.",
  },
};

export const MultipleImages: Story = {
  args: {
    media: [
      { url: gradientSvg("#0ea5e9", "#6366f1", "1/3"), width: 800, height: 600 },
      { url: gradientSvg("#22c55e", "#84cc16", "2/3"), width: 800, height: 600 },
      { url: gradientSvg("#a855f7", "#ec4899", "3/3"), width: 800, height: 600 },
    ],
    content: "Click left/right halves to navigate.",
  },
};