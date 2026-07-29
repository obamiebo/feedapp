import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FeedApp",
  description: "Internal platform for feedback intake, case resolution, SLA tracking, and approved customer communication."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
