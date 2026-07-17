import { Metadata } from "next";
import { app_url, app_config } from "@/config/app";

export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: new URL(app_url),
    title: "Dastyare Social — CS — DOCS",
    description: "Documentation for Dastyare Social CS",
    keywords: [""],
    authors: [{ name: "Dastyare Social — Team" }],
    robots: {
      index: false,
      follow: false,
    },
    openGraph: {
      title: "Dastyare Social — CS — DOCS",
      description: "Documentation for Dastyare Social CS",
      type: "website",
    },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <body>{children}</body>
    </html>
  );
}
