import localFont from "next/font/local";

/*
  -- ENGLISH FONTS --
*/
export const pally = localFont({
  src: [
    {
      path: "../assets/fonts/Pally/Pally-Regular.ttf",
    },
  ],
  variable: "--font-heading",
  display: "swap",
});

// FUNCTIONS
export function LangFont(locale: string): string {
  switch (locale) {
    case "en":
      return `${pally.className} ${pally.variable}`;
    default:
      return `${pally.className} ${pally.variable}`;
  }
}

export function LangDir(locale: string): string {
  switch (locale) {
    case "en":
      return "ltr";
    default:
      return "ltr";
  }
}
