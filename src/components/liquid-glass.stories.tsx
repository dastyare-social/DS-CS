import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "@/components/button";

/* Glass only reads as glass when there is something to refract, so every
   story here sits on the same busy backdrop. Swap it for your real content
   when checking contrast. */
function Backdrop({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-full overflow-hidden p-10">
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,#f97316_0%,transparent_45%),radial-gradient(circle_at_80%_70%,#0ea5e9_0%,transparent_45%),radial-gradient(circle_at_50%_110%,#a855f7_0%,transparent_50%)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-40 [background-image:repeating-linear-gradient(45deg,transparent_0_12px,#000_12px_24px)]"
      />
      <div className="relative">{children}</div>
    </div>
  );
}

const meta = {
  title: "Design System/Liquid Glass",
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Material: Story = {
  render: () => (
    <Backdrop>
      <div className="flex flex-wrap items-center gap-6">
        <div className="liquid-glass rounded-2xl px-6 py-4">
          <p className="text-foreground">Bare .liquid-glass panel</p>
          <p className="text-sm text-foreground/60">
            No other classes — this is the default tint.
          </p>
        </div>

        <div className="liquid-glass rounded-full px-6 py-3">
          <span className="text-foreground">Pill shape</span>
        </div>

        <div className="liquid-glass h-24 w-24 rounded-2xl" />
      </div>
    </Backdrop>
  ),
};

export const TokenOverrides: Story = {
  name: "Token overrides",
  render: () => (
    <Backdrop>
      <div className="flex flex-wrap items-center gap-6">
        <div className="liquid-glass rounded-2xl px-6 py-4 [--liquid-glass-bg:color-mix(in_srgb,var(--primary)_22%,transparent)] [--liquid-glass-border-color:color-mix(in_srgb,var(--primary)_40%,transparent)]">
          <p className="text-foreground">Brand-tinted</p>
        </div>

        <div className="liquid-glass rounded-2xl px-6 py-4 [--liquid-glass-blur:4px]">
          <p className="text-foreground">Crisp (4px blur)</p>
        </div>

        <div className="liquid-glass rounded-2xl px-6 py-4 [--liquid-glass-blur:40px] [--liquid-glass-saturate:300%]">
          <p className="text-foreground">Frosted (40px, 300%)</p>
        </div>

        <div className="liquid-glass rounded-2xl border-[3px] px-6 py-4 [--liquid-glass-border-width:3px] [--liquid-glass-border-color:#fff]">
          <p className="text-foreground">Thick white rim</p>
        </div>
      </div>
    </Backdrop>
  ),
};

export const ButtonsOverBackdrop: Story = {
  render: () => (
    <Backdrop>
      <div className="flex flex-wrap items-center gap-4">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button disabled>Disabled</Button>
        <Button asChild>
          <a href="#">As child</a>
        </Button>
      </div>
    </Backdrop>
  ),
};