import type { Metadata } from "next";

import "./globals.css";
import "./protected/protected.css";

export const metadata: Metadata = {
  title: {
    default: "Gate",
    template: "%s · Gate",
  },
  description:
    "A design-first access gate for private Next.js experiences — without the browser Basic Auth dialog.",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
  referrer: "no-referrer",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
