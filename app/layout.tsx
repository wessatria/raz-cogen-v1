import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Raz CogenScreen MY",
  description: "Budget-level cogeneration screening and proposal workflow for Raz Engineering.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
