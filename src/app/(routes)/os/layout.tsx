import { Metadata } from "next";
import React from "react";

export async function generateMetadata(): Promise<Metadata> {
  return {
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default function layout({ children }: { children: React.ReactNode }) {
  return children;
}
