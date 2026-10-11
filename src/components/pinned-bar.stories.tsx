import type { Meta, StoryObj } from "@storybook/react-vite";
import type { CSSProperties } from "react";

import PinnedBar from "@/components/pinned-bar";
import type { PostWithReactions } from "@/lib/api/posts/queries";

const fakePosts = [
  { type: "text", content: "This is a pinned post preview line that wraps when long." },
  { type: "image", content: null },
  { type: "video", content: null },
] as unknown as PostWithReactions[];

const meta = {
  title: "Design System/PinnedBar",
  component: PinnedBar,
  tags: ["autodocs"],
  args: {
    pinnedPosts: fakePosts,
    activeIndex: 0,
    onCycle: () => undefined,
    onUnpin: () => undefined,
  },
  argTypes: {
    pinnedPosts: { control: false },
    activeIndex: { control: { type: "number", min: 0 } },
    onCycle: { control: false },
    onUnpin: { control: false },
  },
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof PinnedBar>;

export default meta;
type Story = StoryObj<typeof meta>;

const wrapperStyle = {
  "--chat-header-height": "56px",
} as CSSProperties;

/* PinnedBar is `fixed`, so the glass needs real content behind it to refract.
   A flat white canvas renders the material invisible. */
function Stage({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-[420px] w-full" style={wrapperStyle}>
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,#f97316_0%,transparent_45%),radial-gradient(circle_at_85%_30%,#0ea5e9_0%,transparent_40%),radial-gradient(circle_at_50%_90%,#a855f7_0%,transparent_45%)]"
      />
      <div className="relative mx-auto flex max-w-2xl flex-col gap-3 px-4 pt-24 pb-6">
        <div className="h-24 rounded-2xl bg-white/25" />
        <div className="h-32 rounded-2xl bg-white/25" />
        <div className="h-24 rounded-2xl bg-white/25" />
      </div>
      {children}
    </div>
  );
}

export const SinglePinned: Story = {
  args: {
    pinnedPosts: [fakePosts[0]],
    activeIndex: 0,
  },
  render: (args) => (
    <Stage>
      <PinnedBar {...args} />
    </Stage>
  ),
};

export const MultiplePinned: Story = {
  args: {
    pinnedPosts: fakePosts,
    activeIndex: 1,
  },
  render: (args) => (
    <Stage>
      <PinnedBar {...args} />
    </Stage>
  ),
};