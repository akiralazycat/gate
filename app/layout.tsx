import type { Metadata } from "next";

import "./globals.css";
import "./demo.css";
import "./protected/protected.css";

export const metadata: Metadata = {
  title: {
    default: "Gate",
    template: "%s · Gate",
  },
  description:
    "A design-first access gate for private Next.js experiences — without the browser Basic Auth dialog.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
