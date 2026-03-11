import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "fa-knowledge-app",
  description: "Proof-of-concept knowledge base with private and shared workspaces.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
