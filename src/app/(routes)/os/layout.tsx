import { Metadata } from "next";
import React from "react";
import { panelMetadata } from "../../../../config/metadata";

export async function generateMetadata(): Promise<Metadata> {
  return panelMetadata();
}

export default function layout({ children }: { children: React.ReactNode }) {
  return children;
}
