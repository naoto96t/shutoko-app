import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "首都高 周回ドライブプランナー",
  description: "首都高の最安出口と周回ドライブ向けルートを探すアプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
