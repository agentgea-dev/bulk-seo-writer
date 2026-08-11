import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bulk SEO Writer — Keyword List → Artikel + SEO Score",
  description:
    "Batch AI content generator: paste keywords, generate articles, get a deterministic SEO score per article, export as Markdown or .zip.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
