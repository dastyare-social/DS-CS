import type { Meta, StoryObj } from "@storybook/react-vite";

type TokenSpec = { name: string; var: string; note?: string };

const TOKEN_GROUPS: Array<{ group: string; tokens: TokenSpec[] }> = [
  {
    group: "Base surface",
    tokens: [
      { name: "background", var: "--background" },
      { name: "foreground", var: "--foreground" },
    ],
  },
  {
    group: "Brand",
    tokens: [
      { name: "primary", var: "--primary", note: "actions / accents" },
      { name: "secondary", var: "--secondary" },
    ],
  },
  {
    group: "Button",
    tokens: [
      { name: "button-background", var: "--button-background" },
      { name: "button-foreground", var: "--button-foreground" },
      { name: "button-border", var: "--button-border" },
    ],
  },
  {
    group: "Icon",
    tokens: [
      { name: "icon-background", var: "--icon-background" },
      { name: "icon-foreground", var: "--icon-foreground" },
      { name: "icon-border", var: "--icon-border" },
    ],
  },
  {
    group: "Selection",
    tokens: [
      { name: "selection-foreground", var: "--selection-foreground" },
      { name: "selection-background", var: "--selection-background" },
    ],
  },
];

function TokensGallery() {
  const rootStyles = getComputedStyle(document.documentElement);
  const resolve = (variable: string) => rootStyles.getPropertyValue(variable).trim();

  return (
    <div className="flex w-full max-w-3xl flex-col gap-8 p-4">
      {TOKEN_GROUPS.map(({ group, tokens }) => (
        <section key={group} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">{group}</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {tokens.map((token) => {
              const value = resolve(token.var);
              return (
                <div
                  key={token.var}
                  data-token={token.name}
                  className="flex flex-col gap-2 rounded-xl border border-foreground/10 bg-white/40 p-3"
                >
                  <div
                    className="h-10 rounded-lg border border-foreground/10"
                    style={{ backgroundColor: value }}
                  />
                  <div className="text-sm font-medium text-foreground">
                    {token.name}
                  </div>
                  <code className="text-xs text-foreground/60">
                    {value || "undefined"}
                  </code>
                  {token.note ? (
                    <span className="text-xs text-foreground/50">
                      {token.note}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

const meta = {
  title: "Design System/Tokens",
  component: TokensGallery,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof TokensGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ColorTokens: Story = {};