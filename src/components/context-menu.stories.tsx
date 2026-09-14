import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuEmojiBar,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/context-menu";

const meta = {
  title: "Design System/ContextMenu",
  component: ContextMenu,
  tags: ["autodocs"],
} satisfies Meta<typeof ContextMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FullMenu: Story = {
  args: { children: undefined },
  render: () => (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          data-testid="ctx-trigger"
          className="grid h-44 w-80 cursor-context-menu place-items-center rounded-2xl border border-dashed border-foreground/20 text-sm text-foreground/60"
        >
          Right-click (or long-press) anywhere in this box
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuLabel>Actions</ContextMenuLabel>
        <ContextMenuItem>Copy</ContextMenuItem>
        <ContextMenuItem>Replace</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuCheckboxItem checked>Bookmark</ContextMenuCheckboxItem>
        <ContextMenuCheckboxItem>Pin to top</ContextMenuCheckboxItem>
        <ContextMenuSeparator />
        <ContextMenuLabel>Sort</ContextMenuLabel>
        <ContextMenuRadioGroup value="asc" onValueChange={() => undefined}>
          <ContextMenuRadioItem value="asc">Ascending</ContextMenuRadioItem>
          <ContextMenuRadioItem value="desc">Descending</ContextMenuRadioItem>
        </ContextMenuRadioGroup>
        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger inset>Share</ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-44">
            <ContextMenuItem>Copy link</ContextMenuItem>
            <ContextMenuItem>Send in message</ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive">Delete…</ContextMenuItem>
      </ContextMenuContent>
      <ContextMenuEmojiBar
        emojis={["👍", "❤️", "😂", "😮", "😢", "🙏"]}
        onSelect={() => undefined}
        menuWidth={224}
      />
    </ContextMenu>
  ),
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector<HTMLElement>(
      '[data-testid="ctx-trigger"]',
    );
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    trigger.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
  },
};