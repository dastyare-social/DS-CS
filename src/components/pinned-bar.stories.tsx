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

export const SinglePinned: Story = {
  args: {
    pinnedPosts: [fakePosts[0]],
    activeIndex: 0,
  },
  render: (args) => (
    <div className="w-full max-w-2xl" style={wrapperStyle}>
      <PinnedBar {...args} />
    </div>
  ),
};

export const MultiplePinned: Story = {
  args: {
    pinnedPosts: fakePosts,
    activeIndex: 1,
  },
  render: (args) => (
    <div className="w-full max-w-2xl" style={wrapperStyle}>
      <PinnedBar {...args} />
    </div>
  ),
};