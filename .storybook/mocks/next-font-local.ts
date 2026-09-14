type LocalFontOptions = {
  src: Array<{ path: string; weight?: string; style?: string }> | string;
  variable?: string;
  display?: string;
  weight?: string;
  style?: string;
};

// Storybook stand-in for `next/font/local` (not available in the SB iframe).
// Returns a real utility class backed by the Pally @font-face declared in
// `./preview.css`, so components using `pally.className` (via `@/lib/fonts`)
// render with the actual project font.
export default function localFont(options: LocalFontOptions | undefined) {
  return {
    className: "sb-font-pally",
    variable: options?.variable ?? undefined,
    style: {
      fontFamily: '"Pally", ui-sans-serif, system-ui, sans-serif',
    },
  };
}