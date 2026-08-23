import type { Metadata } from "next";

import ThemeBuilder from "@/components/theme-builder";
import { getGateTheme } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Theme Builder",
  description: "Design and export a Gate access surface.",
};

export default function BuilderPage() {
  return <ThemeBuilder initialTheme={getGateTheme()} />;
}
