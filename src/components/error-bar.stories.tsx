import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, type CSSProperties } from "react";

import ErrorBar from "@/components/error-bar";
import { raiseError } from "@/lib/error-bar";

const meta = {
  title: "Design System/ErrorBar",
  component: ErrorBar,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof ErrorBar>;

export default meta;
type Story = StoryObj<typeof meta>;

const wrapperStyle = {
  // Mirrors the public feed: a footer, with the bar parked on top of it.
  "--error-bar-bottom": "96px",
} as CSSProperties;

/* ErrorBar is `fixed`, so the glass needs real content behind it to refract.
   A flat white canvas renders the material invisible. */
function Stage() {
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
      <div className="absolute bottom-0 left-1/2 z-50 w-full max-w-2xl -translate-x-1/2">
        <div className="flex w-full justify-center px-4 pb-3">
          <div className="liquid-glass rounded-2xl px-3.5 py-1.5 text-sm">
            Footer
          </div>
        </div>
      </div>
    </div>
  );
}

/** ErrorBar has no props — it renders in response to `raiseError()`. */
function Fire({ error, fallback }: { error: unknown; fallback?: string }) {
  useEffect(() => {
    raiseError(error, fallback);
  }, [error, fallback]);

  return (
    <>
      <Stage />
      <ErrorBar />
    </>
  );
}

export const Transient: Story = {
  render: () => (
    <Fire error="Couldn't reach the server. Check your connection." />
  ),
};

export const ErrorObject: Story = {
  render: () => <Fire error={new Error("Upload failed: 500")} />,
};

export const WithFallback: Story = {
  render: () => <Fire error={{ code: 42 }} fallback="Something went wrong" />,
};

export const LongMessage: Story = {
  render: () => (
    <Fire error="Only one audio file can be attached. 2 other files skipped because a post carries a single media type." />
  ),
};
