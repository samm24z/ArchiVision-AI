import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ArchiVision AI",
  description:
    "An AI copilot for architecture, interior design, and home planning.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
